import { useWords } from "../../../src/locale";
import { useState, useEffect } from "react";
import { Image, Text, View, Switch } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import {
  api,
  restoreSession,
  privateImage,
  uploadPhoto,
  ApiError,
} from "../../../src/api";
import {
  Screen,
  Title,
  Action,
  ErrorText,
  Loading,
  styles,
} from "../../../src/ui";
type Job = {
  id: string;
  productId: string;
  photoId: string;
  outputId: string | null;
  status: string;
  creditedBack: boolean;
  expiresAt: string;
};
export default function FittingRoom() {
  const t = useWords();

  const { slug, id } = useLocalSearchParams<{ slug: string; id: string }>(),
    router = useRouter(),
    client = useQueryClient();
  const base = `/storefront/${encodeURIComponent(slug)}`,
    [ready, setReady] = useState(false),
    [consent, setConsent] = useState(false),
    [adult, setAdult] = useState(false),
    [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>(),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(),
    [after, setAfter] = useState(true);
  useEffect(() => {
    restoreSession(slug).finally(() => setReady(true));
  }, [slug]);
  const capability = useQuery({
    queryKey: ["try-on-capability", slug],
    queryFn: () => api<{ enabled: boolean }>(`${base}/try-on`),
  });
  const jobs = useQuery({
    queryKey: ["customer", slug, "try-on"],
    queryFn: () => api<Job[]>(`${base}/customer/try-on`, slug),
    enabled: ready && capability.data?.enabled === true,
    refetchInterval: 5000,
    retry: false,
  });
  async function pick(camera = false) {
    setError(null);
    try {
      if (camera) {
        const granted = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted.granted)
          throw new Error("Allow camera access or choose a photo instead.");
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.85,
        base64: true,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const asset = result.assets[0];
        if (!asset?.base64) throw new Error("This photo could not be read.");
        setPhoto(asset);
      }
    } catch (err) {
      setError(err);
    }
  }
  async function generate() {
    if (!photo?.base64 || !consent || !adult) return;
    setPending(true);
    setError(null);
    let photoId = "";
    try {
      const mime = photo.mimeType ?? "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
        throw new Error("Choose a JPEG, PNG or WebP photo.");
      const uploaded = await uploadPhoto(slug, photo.base64, mime);
      photoId = uploaded.id;
      await api(
        `${base}/customer/try-on`,
        slug,
        "POST",
        { productId: id, photoId, consent: true, adult: true },
        Crypto.randomUUID(),
      );
      setPhoto(undefined);
      await client.invalidateQueries({
        queryKey: ["customer", slug, "try-on"],
      });
    } catch (err) {
      setError(err);
      if (photoId)
        await api(`${base}/customer/media/${photoId}`, slug, "DELETE").catch(
          () => {},
        );
    } finally {
      setPending(false);
    }
  }
  async function remove(job: Job) {
    setPending(true);
    setError(null);
    try {
      await api(`${base}/customer/try-on/${job.id}`, slug, "DELETE");
      await client.invalidateQueries({
        queryKey: ["customer", slug, "try-on"],
      });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  const signedOut = jobs.error instanceof ApiError && jobs.error.status === 401;
  return (
    <Screen>
      <Title
        eyebrow={t("A DIFFERENT PERSPECTIVE")}
        subtitle={t(
          "A private preview of the look. Size and fit are not guaranteed.",
        )}
      >
        {t("Your fitting room.")}
      </Title>
      <ErrorText
        error={error ?? capability.error ?? (!signedOut ? jobs.error : null)}
      />
      {capability.isPending ? (
        <Loading />
      ) : !capability.data?.enabled ? (
        <Text style={styles.copy}>
          {t("Virtual fitting is not available for this boutique.")}{" "}
        </Text>
      ) : signedOut ? (
        <Action
          onPress={() =>
            router.push({ pathname: "/account/[slug]", params: { slug } })
          }
        >
          {t("Sign in to use the fitting room")}
        </Action>
      ) : (
        <>
          {photo && (
            <Image
              source={{ uri: photo.uri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={t("Your selected photo")}
            />
          )}
          <Action secondary disabled={pending} onPress={() => void pick()}>
            {t("Choose your photo")}
          </Action>
          <Action secondary disabled={pending} onPress={() => void pick(true)}>
            {t("Take your photo")}
          </Action>
          <View style={styles.row}>
            <Text style={[styles.copy, { flex: 1 }]}>
              {t("I am 18 or older and this is a photo of me.")}{" "}
            </Text>
            <Switch
              accessibilityLabel={t("Adult and own photo confirmation")}
              value={adult}
              onValueChange={setAdult}
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.copy, { flex: 1 }]}>
              {t(
                "I agree to send my photo to Fal for this preview, and have read the boutique’s privacy policy. Photos are stored privately for up to 24 hours.",
              )}{" "}
            </Text>
            <Switch
              accessibilityLabel={t("Consent to Fal photo processing")}
              value={consent}
              onValueChange={setConsent}
            />
          </View>
          <Action
            disabled={pending || !photo || !consent || !adult}
            onPress={() => void generate()}
          >
            {pending ? t("Preparing…") : t("Create my fitting preview")}
          </Action>
          {jobs.data
            ?.filter((job) => job.productId === id)
            .map((job) => (
              <View key={job.id} style={styles.card}>
                <Text style={styles.heading}>
                  {job.status === "COMPLETED"
                    ? t("Your preview is ready.")
                    : job.status === "FAILED"
                      ? `${t("Preview failed.")}${job.creditedBack ? t(" Credit returned.") : ""}`
                      : t(job.status)}
                </Text>
                {job.outputId && (
                  <>
                    <Image
                      source={privateImage(
                        slug,
                        after ? job.outputId : job.photoId,
                      )}
                      style={styles.image}
                      resizeMode="contain"
                      accessibilityLabel={
                        after ? t("Generated preview") : t("Original photo")
                      }
                    />
                    <Action secondary onPress={() => setAfter(!after)}>
                      {after
                        ? t("Show original photo")
                        : t("Show generated preview")}
                    </Action>
                  </>
                )}
                <Text style={styles.copy}>
                  {t("Expires")} {new Date(job.expiresAt).toLocaleString()}.
                </Text>
                <Action
                  secondary
                  disabled={pending}
                  onPress={() => void remove(job)}
                >
                  {t("Delete preview and photos")}
                </Action>
              </View>
            ))}
        </>
      )}
    </Screen>
  );
}
