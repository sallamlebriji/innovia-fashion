import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
export type Locale = "en" | "fr" | "ar";
export const useLocale = create<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>()(
  persist((set) => ({ locale: "en", setLocale: (locale) => set({ locale }) }), {
    name: "innovia.native.locale",
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state) => ({ locale: state.locale }),
    merge: (persisted, current) => {
      const stored = persisted as { locale?: unknown } | undefined;
      return {
        ...current,
        locale:
          stored && ["en", "fr", "ar"].includes(String(stored.locale))
            ? (stored.locale as Locale)
            : "en",
      };
    },
  }),
);
const words: Record<string, readonly [string, string]> = {
  Language: ["Langue", "اللغة"],
  "Order tracking is temporarily unavailable. Contact your boutique with your order number.":
    [
      "Le suivi est temporairement indisponible. Contactez votre boutique avec votre numéro de commande.",
      "تتبع الطلب غير متاح مؤقتاً. تواصل مع متجرك وأعطه رقم الطلب.",
    ],
  "Notifications are unavailable on this device. Your messages remain in your account.":
    [
      "Les notifications sur cet appareil sont indisponibles. Vos messages restent accessibles dans votre compte.",
      "إشعارات هذا الجهاز غير متاحة. تبقى رسائلك متاحة في حسابك.",
    ],
  "Notifications were not enabled. You can still read updates in your account.":
    [
      "Les notifications n’ont pas été activées. Vous pouvez consulter les messages dans votre compte.",
      "لم تُفعّل الإشعارات. يمكنك قراءة المستجدات في حسابك.",
    ],
  Hello: ["Bonjour", "مرحباً"],
  Orders: ["Commandes", "الطلبات"],
  Wishlist: ["Favoris", "المفضلة"],
  Addresses: ["Adresses", "العناوين"],
  Notifications: ["Notifications", "الإشعارات"],
  category: ["Catégorie", "الفئة"],
  collection: ["Collection", "المجموعة"],
  brand: ["Marque", "العلامة التجارية"],
  size: ["Taille", "المقاس"],
  color: ["Couleur", "اللون"],
  IN_APP_MARKETING: ["Marketing dans l’application", "التسويق داخل التطبيق"],
  EMAIL_MARKETING: ["Marketing par e-mail", "التسويق بالبريد الإلكتروني"],
  SMS_MARKETING: ["Marketing par SMS", "التسويق بالرسائل النصية"],
  PUSH_MARKETING: ["Notifications marketing", "إشعارات التسويق"],
  QUEUED: ["En attente", "قيد الانتظار"],
  PROCESSING: ["En cours", "جارٍ المعالجة"],
  SUBMITTING: ["Envoi en cours", "جارٍ الإرسال"],
  ACTIVE: ["Active", "نشط"],
  REDEEMED: ["Utilisé", "مستخدم"],
  REVERSED: ["Annulé", "تم التراجع"],
  "Preview failed.": ["L’aperçu a échoué.", "تعذر إنشاء المعاينة."],
  "Saved.": ["Enregistré.", "تم الحفظ."],
  "Added to your bag.": ["Ajouté au panier.", "تمت الإضافة إلى حقيبتك."],
  "Saved to your personal edit.": [
    "Ajouté à votre sélection.",
    "تم الحفظ في اختياراتك الشخصية.",
  ],
  "Data export prepared.": [
    "Export des données préparé.",
    "تم إعداد تصدير البيانات.",
  ],
  "Account deleted.": ["Compte supprimé.", "تم حذف الحساب."],
  "Welcome to your boutique account.": [
    "Bienvenue dans votre compte boutique.",
    "مرحباً بك في حساب متجرك.",
  ],
  "Preferences saved.": ["Préférences enregistrées.", "تم حفظ التفضيلات."],
  "Signed out.": ["Déconnexion réussie.", "تم تسجيل الخروج."],
  "If this email has an account, its recovery link will be sent.": [
    "Si cette adresse possède un compte, un lien de récupération sera envoyé.",
    "إذا كان لهذا البريد حساب، فسيُرسل رابط الاستعادة.",
  ],
  "Allow camera access or choose a photo instead.": [
    "Autorisez la caméra ou choisissez une photo.",
    "اسمح بالوصول إلى الكاميرا أو اختر صورة.",
  ],
  "This photo could not be read.": [
    "Cette photo ne peut pas être lue.",
    "تعذر قراءة هذه الصورة.",
  ],
  "Choose a JPEG, PNG or WebP photo.": [
    "Choisissez une photo JPEG, PNG ou WebP.",
    "اختر صورة JPEG أو PNG أو WebP.",
  ],
  RESERVED: ["Réservée", "محجوز"],
  CONFIRMED: ["Confirmée", "مؤكد"],
  READY: ["Prête", "جاهز"],
  DISPATCHED: ["Expédiée", "تم الإرسال"],
  COMPLETED: ["Terminée", "مكتمل"],
  DELIVERED: ["Livrée", "تم التوصيل"],
  CANCELLED: ["Annulée", "ملغى"],
  EXPIRED: ["Expirée", "منتهي"],
  PAID: ["Payée", "مدفوع"],
  "INNOVIA / Discover": ["INNOVIA / Découvrir", "INNOVIA / اكتشف"],
  "The boutique": ["La boutique", "المتجر"],
  "Your next favourite": [
    "Votre prochaine pièce favorite",
    "قطعتك المفضلة القادمة",
  ],
  "Your bag": ["Votre panier", "حقيبتك"],
  "Your fitting room": ["Votre cabine d’essayage", "غرفة القياس الخاصة بك"],
  "Your account": ["Votre compte", "حسابك"],
  "A DIFFERENT PERSPECTIVE": ["UNE AUTRE PERSPECTIVE", "منظور مختلف"],
  "A considered collection.": [
    "Une collection réfléchie.",
    "مجموعة مختارة بعناية.",
  ],
  "A little space for something beautiful.": [
    "Une place pour quelque chose de beau.",
    "مساحة لشيء جميل.",
  ],
  "A personal edit.": ["Une sélection personnelle.", "اختيارات شخصية."],
  "A place for your favourites.": [
    "Un espace pour vos pièces favorites.",
    "مساحة لقطعك المفضلة.",
  ],
  "A private preview of the look. Size and fit are not guaranteed.": [
    "Un aperçu privé de la tenue. La taille et la coupe ne sont pas garanties.",
    "معاينة خاصة للإطلالة. المقاس والملاءمة غير مضمونين.",
  ],
  "Accept account terms": [
    "Accepter les conditions du compte",
    "الموافقة على شروط الحساب",
  ],
  "Add an address": ["Ajouter une adresse", "إضافة عنوان"],
  "Add to bag +": ["Ajouter au panier +", "إضافة إلى الحقيبة +"],
  "Address label": ["Nom de l’adresse", "اسم العنوان"],
  "Adult and own photo confirmation": [
    "Confirmation de majorité et de photo personnelle",
    "تأكيد بلوغ السن القانوني وملكية الصورة",
  ],
  All: ["Tout", "الكل"],
  "Already a member? Sign in": [
    "Déjà membre ? Connectez-vous",
    "عضو بالفعل؟ سجّل الدخول",
  ],
  "Birthday (YYYY-MM-DD, optional)": [
    "Date de naissance (AAAA-MM-JJ, facultatif)",
    "تاريخ الميلاد (YYYY-MM-DD، اختياري)",
  ],
  "Boutique pickup": ["Retrait en boutique", "الاستلام من المتجر"],
  "Cash on delivery": ["Paiement à la livraison", "الدفع عند التوصيل"],
  "Choose your photo": ["Choisir votre photo", "اختر صورتك"],
  "Choose your size, save a piece and shop with boutique pickup or configured delivery. Your web and mobile membership share one balance.":
    [
      "Choisissez votre taille, enregistrez une pièce et optez pour le retrait en boutique ou la livraison proposée. Votre fidélité web et mobile partage le même solde.",
      "اختر مقاسك واحفظ قطعة وتسوق مع الاستلام من المتجر أو التوصيل المتاح. تشترك عضويتك على الويب والهاتف في رصيد واحد.",
    ],
  City: ["Ville", "المدينة"],
  "Clear filters": ["Effacer les filtres", "مسح المرشحات"],
  "Compare measurements": ["Comparer les mesures", "مقارنة القياسات"],
  "Confirm account deletion": [
    "Confirmer la suppression du compte",
    "تأكيد حذف الحساب",
  ],
  "Confirm delivery order": [
    "Confirmer la commande à livrer",
    "تأكيد طلب التوصيل",
  ],
  "Confirm pickup reservation": [
    "Confirmer la réservation en boutique",
    "تأكيد حجز الاستلام",
  ],
  "Consent to Fal photo processing": [
    "Consentir au traitement de la photo par Fal",
    "الموافقة على معالجة الصورة لدى Fal",
  ],
  "Consent to membership": ["Consentir à l’adhésion", "الموافقة على العضوية"],
  "Contact your boutique with this number for returns and exchanges.": [
    "Contactez votre boutique avec ce numéro pour un retour ou un échange.",
    "تواصل مع متجرك باستخدام هذا الرقم للإرجاع والاستبدال.",
  ],
  Continue: ["Continuer", "متابعة"],
  "Create account": ["Créer un compte", "إنشاء حساب"],
  "Create my fitting preview": [
    "Créer mon aperçu d’essayage",
    "إنشاء معاينة القياس",
  ],
  "Current password": ["Mot de passe actuel", "كلمة المرور الحالية"],
  "Delete account": ["Supprimer le compte", "حذف الحساب"],
  "Delete preview and photos": [
    "Supprimer l’aperçu et les photos",
    "حذف المعاينة والصور",
  ],
  "Delivery area": ["Zone de livraison", "منطقة التوصيل"],
  "Delivery phone": ["Téléphone de livraison", "هاتف التوصيل"],
  "Delivery:": ["Livraison :", "التوصيل:"],
  "Details & care": ["Détails et entretien", "التفاصيل والعناية"],
  "Disable device notifications": [
    "Désactiver les notifications de cet appareil",
    "تعطيل إشعارات هذا الجهاز",
  ],
  "Discover boutiques with a point of view. Keep their collections, your favourites and your orders together.":
    [
      "Découvrez des boutiques singulières. Retrouvez leurs collections, vos favoris et vos commandes au même endroit.",
      "اكتشف متاجر ذات طابع خاص. اجمع مجموعاتها وقطعك المفضلة وطلباتك في مكان واحد.",
    ],
  "Discover your boutiques": ["Découvrir les boutiques", "اكتشف متاجرك"],
  "Dispatch boutique": ["Boutique d’expédition", "متجر الإرسال"],
  Email: ["E-mail", "البريد الإلكتروني"],
  "Email address": ["Adresse e-mail", "البريد الإلكتروني"],
  "Enable device notifications": [
    "Activer les notifications de cet appareil",
    "تفعيل إشعارات هذا الجهاز",
  ],
  Expires: ["Expire le", "ينتهي في"],
  "Export my account data": [
    "Exporter les données de mon compte",
    "تصدير بيانات حسابي",
  ],
  "FICTIONAL DEMO BOUTIQUE": ["BOUTIQUE DÉMO FICTIVE", "متجر تجريبي خيالي"],
  "Favourite categories (comma separated, up to 10)": [
    "Catégories favorites (séparées par des virgules, jusqu’à 10)",
    "الفئات المفضلة (مفصولة بفواصل، حتى 10)",
  ],
  "Find a boutique": ["Trouver une boutique", "ابحث عن متجر"],
  "Find a boutique. Discover your next everyday favourite.": [
    "Trouvez une boutique. Découvrez votre prochaine pièce du quotidien.",
    "ابحث عن متجر. اكتشف قطعتك اليومية المفضلة القادمة.",
  ],
  "Garment measurements in cm. Compare with a piece you own; fit is not guaranteed.":
    [
      "Mesures du vêtement en cm. Comparez avec une pièce que vous possédez ; la coupe n’est pas garantie.",
      "قياسات القطعة بالسنتيمتر. قارنها بقطعة لديك؛ الملاءمة غير مضمونة.",
    ],
  "Generated preview": ["Aperçu généré", "المعاينة المُنشأة"],
  "I agree to create a boutique account. Marketing is optional.": [
    "J’accepte de créer un compte dans cette boutique. Le marketing est facultatif.",
    "أوافق على إنشاء حساب في المتجر. التسويق اختياري.",
  ],
  "I agree to send my photo to Fal for this preview, and have read the boutique’s privacy policy. Photos are stored privately for up to 24 hours.":
    [
      "J’accepte d’envoyer ma photo à Fal pour cet aperçu et j’ai lu la politique de confidentialité de la boutique. Les photos sont conservées de manière privée pendant 24 heures maximum.",
      "أوافق على إرسال صورتي إلى Fal لهذه المعاينة، وقد قرأت سياسة خصوصية المتجر. تُحفظ الصور بشكل خاص لمدة لا تتجاوز 24 ساعة.",
    ],
  "I am 18 or older and this is a photo of me.": [
    "J’ai au moins 18 ans et cette photo me représente.",
    "عمري 18 سنة أو أكثر وهذه صورة لي.",
  ],
  "I choose to join the loyalty program and accept its earning, redemption, and expiry rules.":
    [
      "Je choisis d’adhérer au programme de fidélité et j’accepte ses règles de cumul, d’utilisation et d’expiration.",
      "أختار الانضمام إلى برنامج الولاء وأوافق على قواعد اكتساب النقاط واستخدامها وانتهائها.",
    ],
  "I understand my account will be deleted.": [
    "Je comprends que mon compte sera supprimé.",
    "أفهم أن حسابي سيُحذف.",
  ],
  "INNOVIA / INDEPENDENT FASHION": [
    "INNOVIA / MODE INDÉPENDANTE",
    "INNOVIA / أزياء مستقلة",
  ],
  "Independent spirit.": ["Un esprit indépendant.", "روح مستقلة."],
  "Join membership": ["Adhérer au programme", "الانضمام إلى العضوية"],
  "Join your boutique": ["Rejoindre votre boutique", "انضم إلى متجرك"],
  "Mark as read": ["Marquer comme lu", "وضع علامة مقروء"],
  "Marketing and photo fitting are optional. You control your account, saved photos and preferences inside each boutique.":
    [
      "Le marketing et l’essayage photo sont facultatifs. Vous contrôlez votre compte, vos photos et vos préférences dans chaque boutique.",
      "التسويق والقياس بالصور اختياريان. أنت تتحكم في حسابك وصورك المحفوظة وتفضيلاتك داخل كل متجر.",
    ],
  "Marketing preferences are separate from transactional order messages.": [
    "Les préférences marketing sont distinctes des messages liés aux commandes.",
    "تفضيلات التسويق منفصلة عن رسائل الطلبات.",
  ],
  "Maximum price": ["Prix maximum", "السعر الأقصى"],
  "Measured foot length (cm)": [
    "Longueur mesurée du pied (cm)",
    "طول القدم المقاس (سم)",
  ],
  Membership: ["Fidélité", "العضوية"],
  "Membership voucher (optional)": [
    "Bon de fidélité (facultatif)",
    "قسيمة العضوية (اختيارية)",
  ],
  "Minimum price": ["Prix minimum", "السعر الأدنى"],
  "Moroccan phone": ["Téléphone marocain", "هاتف مغربي"],
  "My boutique data": ["Mes données dans la boutique", "بياناتي في المتجر"],
  "New here? Create an account": [
    "Nouveau ici ? Créez un compte",
    "جديد هنا؟ أنشئ حساباً",
  ],
  Newest: ["Nouveautés", "الأحدث"],
  Next: ["Suivant", "التالي"],
  "No boutiques match your search.": [
    "Aucune boutique ne correspond à votre recherche.",
    "لا توجد متاجر تطابق بحثك.",
  ],
  "No messages yet.": ["Aucun message pour le moment.", "لا توجد رسائل بعد."],
  "No pieces match your search.": [
    "Aucune pièce ne correspond à votre recherche.",
    "لا توجد قطع تطابق بحثك.",
  ],
  "OF 3": ["SUR 3", "من 3"],
  "Open live AR in your browser": [
    "Ouvrir l’essayage AR dans le navigateur",
    "فتح القياس بالواقع المعزز في المتصفح",
  ],
  "Original photo": ["Photo originale", "الصورة الأصلية"],
  Password: ["Mot de passe", "كلمة المرور"],
  Phone: ["Téléphone", "الهاتف"],
  "Pickup boutique": ["Boutique de retrait", "متجر الاستلام"],
  "Please try again.": ["Veuillez réessayer.", "يرجى المحاولة مجدداً."],
  "Please wait…": ["Veuillez patienter…", "يرجى الانتظار…"],
  "Points history": ["Historique des points", "سجل النقاط"],
  "Postal code": ["Code postal", "الرمز البريدي"],
  "Preferred boutique location": ["Boutique préférée", "موقع المتجر المفضل"],
  "Preferred garment chest (cm)": [
    "Tour de poitrine du vêtement préféré (cm)",
    "محيط صدر القطعة المفضل (سم)",
  ],
  "Preferred garment waist (cm)": [
    "Tour de taille du vêtement préféré (cm)",
    "محيط خصر القطعة المفضل (سم)",
  ],
  "Preferred sizes (comma separated, up to 10)": [
    "Tailles préférées (séparées par des virgules, jusqu’à 10)",
    "المقاسات المفضلة (مفصولة بفواصل، حتى 10)",
  ],
  "Preparing…": ["Préparation…", "جارٍ التحضير…"],
  Previous: ["Précédent", "السابق"],
  "Price ↑": ["Prix ↑", "السعر ↑"],
  "Price ↓": ["Prix ↓", "السعر ↓"],
  "Prices include configured tax. Your boutique confirms the final total and reserves stock when you submit.":
    [
      "Les prix incluent les taxes configurées. La boutique confirme le total final et réserve le stock lors de l’envoi.",
      "تشمل الأسعار الضريبة المحددة. يؤكد المتجر المبلغ النهائي ويحجز المخزون عند الإرسال.",
    ],
  Profile: ["Profil", "الملف الشخصي"],
  "Promotion code (optional, use one code or voucher)": [
    "Code promo (facultatif, un seul code ou bon)",
    "رمز العرض (اختياري، استخدم رمزاً أو قسيمة واحدة)",
  ],
  Recipient: ["Destinataire", "المستلم"],
  "Recover your account by email": [
    "Récupérer votre compte par e-mail",
    "استعادة حسابك بالبريد الإلكتروني",
  ],
  "Redeem reward": ["Utiliser la récompense", "استخدام المكافأة"],
  "Referral code (optional)": [
    "Code de parrainage (facultatif)",
    "رمز الإحالة (اختياري)",
  ],
  "Refine the collection": ["Affiner la collection", "تصفية المجموعة"],
  Refresh: ["Actualiser", "تحديث"],
  "Remove address": ["Supprimer l’adresse", "حذف العنوان"],
  "Remove from personal edit": [
    "Retirer de la sélection personnelle",
    "الحذف من الاختيارات الشخصية",
  ],
  "Reserving your pieces…": ["Réservation de vos pièces…", "جارٍ حجز قطعك…"],
  "Save address": ["Enregistrer l’adresse", "حفظ العنوان"],
  "Save profile": ["Enregistrer le profil", "حفظ الملف الشخصي"],
  "Save shopping preferences": [
    "Enregistrer les préférences d’achat",
    "حفظ تفضيلات التسوق",
  ],
  "Save to your personal edit ♡": [
    "Ajouter à votre sélection personnelle ♡",
    "حفظ في اختياراتك الشخصية ♡",
  ],
  "Saved personal details and unused vouchers are removed. Anonymized financial and audit records remain. Finish active orders first.":
    [
      "Les données personnelles et les bons inutilisés sont supprimés. Les données financières et d’audit anonymisées sont conservées. Terminez d’abord les commandes en cours.",
      "تُحذف البيانات الشخصية المحفوظة والقسائم غير المستخدمة. تبقى السجلات المالية وسجلات التدقيق بعد إخفاء الهوية. أكمل الطلبات النشطة أولاً.",
    ],
  "Search the collection": [
    "Rechercher dans la collection",
    "البحث في المجموعة",
  ],
  "Show generated preview": [
    "Afficher l’aperçu généré",
    "عرض المعاينة المُنشأة",
  ],
  "Show original photo": ["Afficher la photo originale", "عرض الصورة الأصلية"],
  "Sign in": ["Se connecter", "تسجيل الدخول"],
  "Sign in to use the fitting room": [
    "Connectez-vous pour utiliser l’essayage",
    "سجّل الدخول لاستخدام غرفة القياس",
  ],
  "Sign out": ["Se déconnecter", "تسجيل الخروج"],
  "Size guide": ["Guide des tailles", "دليل المقاسات"],
  "Skip introduction": ["Passer l’introduction", "تخطي المقدمة"],
  "Street and apartment": ["Rue et appartement", "الشارع والشقة"],
  Subtotal: ["Sous-total", "المجموع الفرعي"],
  "THE BOUTIQUE": ["LA BOUTIQUE", "المتجر"],
  "Take your photo": ["Prendre votre photo", "التقط صورتك"],
  "Track order →": ["Suivre la commande →", "تتبع الطلب ←"],
  "Try this piece on your photo": [
    "Essayer cette pièce sur votre photo",
    "جرّب هذه القطعة على صورتك",
  ],
  "View piece": ["Voir la pièce", "عرض القطعة"],
  "View your bag →": ["Voir votre panier →", "عرض حقيبتك ←"],
  "Virtual fitting is not available for this boutique.": [
    "L’essayage virtuel n’est pas disponible dans cette boutique.",
    "القياس الافتراضي غير متاح لهذا المتجر.",
  ],
  Vouchers: ["Bons", "القسائم"],
  "Welcome back": ["Heureux de vous revoir", "مرحباً بعودتك"],
  "Your bag.": ["Votre panier.", "حقيبتك."],
  "Your boutique’s membership program is currently paused.": [
    "Le programme de fidélité de votre boutique est actuellement en pause.",
    "برنامج عضوية متجرك متوقف مؤقتاً حالياً.",
  ],
  "Your choices": ["Vos choix", "اختياراتك"],
  "Your contact details are used to fulfil this order. Marketing consent is separate.":
    [
      "Vos coordonnées sont utilisées pour traiter cette commande. Le consentement marketing est distinct.",
      "تُستخدم بيانات اتصالك لتنفيذ هذا الطلب. الموافقة على التسويق منفصلة.",
    ],
  "Your first favourite is waiting in the collection.": [
    "Votre première pièce favorite vous attend dans la collection.",
    "قطعتك المفضلة الأولى تنتظرك في المجموعة.",
  ],
  "Your fitting room.": ["Votre cabine d’essayage.", "غرفة القياس الخاصة بك."],
  "Your name": ["Votre nom", "اسمك"],
  "Your next favourite awaits.": [
    "Votre prochaine pièce favorite vous attend.",
    "قطعتك المفضلة القادمة تنتظرك.",
  ],
  "Your order is reserved. Keep the private tracking link and contact your boutique to arrange fulfilment.":
    [
      "Votre commande est réservée. Conservez le lien privé de suivi et contactez votre boutique pour organiser le retrait ou la livraison.",
      "تم حجز طلبك. احتفظ برابط التتبع الخاص وتواصل مع متجرك لترتيب الاستلام أو التوصيل.",
    ],
  "Your personal edit": ["Votre sélection personnelle", "اختياراتك الشخصية"],
  "Your preview is ready.": ["Votre aperçu est prêt.", "معاينتك جاهزة."],
  "Your privacy. Your choice.": [
    "Votre vie privée. Votre choix.",
    "خصوصيتك. اختيارك.",
  ],
  "Your purchases, membership, and personal edit.": [
    "Vos achats, votre fidélité et votre sélection personnelle.",
    "مشترياتك وعضويتك واختياراتك الشخصية.",
  ],
  "Your rewards": ["Vos récompenses", "مكافآتك"],
  "Your selected photo": ["Votre photo sélectionnée", "صورتك المختارة"],
  " Credit returned.": [" Crédit restitué.", " تمت إعادة الرصيد."],
  "at collection": ["au retrait", "عند الاستلام"],
  "on delivery": ["à la livraison", "عند التوصيل"],
  due: ["à régler", "مستحق"],
  points: ["points", "نقاط"],
  "points ·": ["points ·", "نقاط ·"],
  "· Chest": ["· Poitrine", "· الصدر"],
  "· Length": ["· Longueur", "· الطول"],
  "· Waist": ["· Taille", "· الخصر"],
};
const labels: Record<string, string> = {
  IN_APP_MARKETING: "In-app marketing",
  EMAIL_MARKETING: "Email marketing",
  SMS_MARKETING: "SMS marketing",
  PUSH_MARKETING: "Marketing notifications",
};
export function useWords() {
  const locale = useLocale((state) => state.locale);
  return (value: string) =>
    ["fr", "ar"].includes(locale)
      ? (words[value]?.[locale === "ar" ? 1 : 0] ?? value)
      : (labels[value] ?? value);
}
