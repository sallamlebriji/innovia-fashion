import { useWords } from "./locale";
import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Title, Action, styles, Loading } from "./ui";
export function Welcome({ children }: { children: React.ReactNode }) {
  const t = useWords();

  const [ready, setReady] = useState(false),
    [complete, setComplete] = useState(false),
    [step, setStep] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem("innovia.onboarding.v1")
      .then((value) => setComplete(value === "complete"))
      .finally(() => setReady(true));
  }, []);
  const chapters = [
    {
      title: t("Independent spirit."),
      copy: t(
        "Discover boutiques with a point of view. Keep their collections, your favourites and your orders together.",
      ),
    },
    {
      title: t("A personal edit."),
      copy: t(
        "Choose your size, save a piece and shop with boutique pickup or configured delivery. Your web and mobile membership share one balance.",
      ),
    },
    {
      title: t("Your privacy. Your choice."),
      copy: t(
        "Marketing and photo fitting are optional. You control your account, saved photos and preferences inside each boutique.",
      ),
    },
  ];
  if (!ready) return <Loading />;
  if (complete) return children;
  const chapter = chapters[step]!;
  return (
    <View style={[styles.card, { marginTop: 50 }]}>
      <Text style={styles.eyebrow}>
        INNOVIA / {step + 1} {t("OF 3")}
      </Text>
      <Title subtitle={chapter.copy}>{chapter.title}</Title>
      <Action
        onPress={async () => {
          if (step < 2) setStep(step + 1);
          else {
            await AsyncStorage.setItem("innovia.onboarding.v1", "complete");
            setComplete(true);
          }
        }}
      >
        {step === 2 ? t("Discover your boutiques") : t("Continue")}
      </Action>
      <Action
        secondary
        onPress={async () => {
          await AsyncStorage.setItem("innovia.onboarding.v1", "complete");
          setComplete(true);
        }}
      >
        {t("Skip introduction")}
      </Action>
    </View>
  );
}
