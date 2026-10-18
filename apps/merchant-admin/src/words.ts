import { usePreferences } from "./state";
import { retailTranslations } from "./retail-words";
export const translations: Record<string, readonly [string, string]> = {
  ...retailTranslations,
  "Your subscription": ["Votre abonnement", "اشتراكك"],
  "Trial ended": ["Essai terminé", "انتهت الفترة التجريبية"],
  "Paid period ended": ["Période payée terminée", "انتهت الفترة المدفوعة"],
  "Trial ends": ["Fin de l’essai", "تنتهي الفترة التجريبية"],
  "Paid through": ["Payé jusqu’au", "مدفوع حتى"],
  "/ month": ["/ mois", "/ شهر"],
  locations: ["établissements", "مواقع"],
  "active employees": ["employés actifs", "موظفون نشطون"],
  "Online billing requires an operator-configured provider. Contact support for activation or a plan change. Existing financial records remain available if a trial expires.":
    [
      "La facturation en ligne nécessite un prestataire configuré par l’opérateur. Contactez l’assistance pour l’activation ou un changement de formule. Les données financières restent accessibles après l’essai.",
      "تتطلب الفوترة الإلكترونية مزوداً يضبطه المشغّل. تواصل مع الدعم للتفعيل أو تغيير الخطة. تبقى السجلات المالية متاحة بعد انتهاء الفترة التجريبية.",
    ],
  "Contact subscription support →": [
    "Contacter l’assistance abonnement →",
    "التواصل مع دعم الاشتراك ←",
  ],
  ACTIVE: ["Actif", "نشط"],
  TRIAL: ["Essai", "تجريبي"],
  PAST_DUE: ["Paiement en retard", "دفع متأخر"],
  SUSPENDED: ["Suspendu", "موقوف"],
  PENDING: ["En attente", "قيد الانتظار"],
  PAID: ["Payée", "مدفوع"],
  VOID: ["Annulée", "ملغى"],
  APPLIED: ["Activé", "مفعّل"],
  SCHEDULED: ["Programmé", "مجدول"],
  REVIEW: ["À vérifier", "يتطلب المراجعة"],
  BANK_TRANSFER: ["Virement bancaire", "تحويل بنكي"],
  CASH: ["Espèces", "نقدي"],
  "Subscription invoices": ["Factures d’abonnement", "فواتير الاشتراك"],
  "SUBSCRIPTION OPERATIONS": ["GESTION DES ABONNEMENTS", "إدارة الاشتراكات"],
  "Billing & paid periods.": [
    "Facturation et périodes payées.",
    "الفوترة والفترات المدفوعة.",
  ],
  "Invoices, verified payments and workspace activation.": [
    "Factures, paiements vérifiés et activation de l’espace.",
    "الفواتير والمدفوعات المتحققة وتفعيل مساحة العمل.",
  ],
  "Collected subscription revenue ·": [
    "Recettes d’abonnement encaissées ·",
    "إيرادات الاشتراكات المحصّلة ·",
  ],
  Merchant: ["Commerçant", "التاجر"],
  Plan: ["Formule", "الخطة"],
  Months: ["Mois", "أشهر"],
  "Period starts": ["Début de période", "بداية الفترة"],
  "Issue subscription invoice": [
    "Émettre la facture d’abonnement",
    "إصدار فاتورة الاشتراك",
  ],
  "Amounts are billed in MAD. Future paid periods activate on their start date; plan limits are checked before activation.":
    [
      "Les montants sont facturés en MAD. Les périodes futures s’activent à leur date de début ; les limites de la formule sont vérifiées avant l’activation.",
      "تُفوتر المبالغ بالدرهم المغربي. تبدأ الفترات المستقبلية المدفوعة في تاريخ بدايتها؛ تُراجع حدود الخطة قبل التفعيل.",
    ],
  "Online payment is awaiting provider configuration. The operator can record verified bank transfers or cash payments.":
    [
      "Le paiement en ligne attend la configuration du prestataire. L’opérateur peut enregistrer des virements ou paiements en espèces vérifiés.",
      "ينتظر الدفع الإلكتروني ضبط المزود. يستطيع المشغّل تسجيل التحويلات البنكية أو المدفوعات النقدية بعد التحقق منها.",
    ],
  "View invoice": ["Voir la facture", "عرض الفاتورة"],
  "Pay through Stripe": ["Payer via Stripe", "الدفع عبر Stripe"],
  "Void unpaid invoice": [
    "Annuler la facture impayée",
    "إلغاء الفاتورة غير المدفوعة",
  ],
  "Recheck activation": ["Revérifier l’activation", "إعادة التحقق من التفعيل"],
  "No subscription invoices have been issued.": [
    "Aucune facture d’abonnement n’a été émise.",
    "لم تصدر أي فواتير اشتراك.",
  ],
  "Payment events requiring review": [
    "Événements de paiement à vérifier",
    "أحداث دفع تتطلب المراجعة",
  ],
  Activation: ["Activation", "التفعيل"],
  "Billed to": ["Facturé à", "مفوتر إلى"],
  subscription: ["abonnement", "اشتراك"],
  Amount: ["Montant", "المبلغ"],
  Status: ["Statut", "الحالة"],
  Paid: ["Payé", "مدفوع"],
  Reference: ["Référence", "المرجع"],
  "Print / save invoice": [
    "Imprimer / enregistrer la facture",
    "طباعة / حفظ الفاتورة",
  ],
  "Record a received payment": [
    "Enregistrer un paiement reçu",
    "تسجيل دفعة مستلمة",
  ],
  "Payment method": ["Mode de paiement", "طريقة الدفع"],
  "Bank transfer": ["Virement bancaire", "تحويل بنكي"],
  Cash: ["Espèces", "نقدي"],
  "Payment reference": ["Référence du paiement", "مرجع الدفع"],
  "I have verified that the full amount was received.": [
    "J’ai vérifié la réception de la totalité du montant.",
    "تحققت من استلام المبلغ كاملاً.",
  ],
  "Record payment & check activation": [
    "Enregistrer le paiement et vérifier l’activation",
    "تسجيل الدفع والتحقق من التفعيل",
  ],
  "Your brand. Beautifully expressed.": [
    "Votre marque. Exprimée avec soin.",
    "علامتك التجارية. بأسلوب جميل.",
  ],
  "Make this workspace yours.": [
    "Personnalisez votre espace.",
    "اجعل مساحة العمل لك.",
  ],
  "Shape your storefront’s identity and editorial campaign.": [
    "Définissez l’identité et la campagne de votre boutique.",
    "صمّم هوية متجرك وحملته.",
  ],
  "A considered home for your boutique’s details.": [
    "Un espace soigné pour les détails de votre boutique.",
    "مساحة منظمة لتفاصيل متجرك.",
  ],
  "ONLINE STORE": ["BOUTIQUE EN LIGNE", "المتجر الإلكتروني"],
  "WORKSPACE SETTINGS": ["PARAMÈTRES DE L’ESPACE", "إعدادات مساحة العمل"],
  "View storefront": ["Voir la boutique", "عرض المتجر"],
  "Brand & campaign studio": [
    "Studio de marque et campagne",
    "استوديو العلامة والحملة",
  ],
  "Brand identity": ["Identité de marque", "هوية العلامة التجارية"],
  "Your changes are shared with your live storefront.": [
    "Vos changements sont visibles sur votre boutique en ligne.",
    "تنعكس تغييراتك على متجرك المنشور.",
  ],
  Connected: ["Connecté", "متصل"],
  "Accent color": ["Couleur d’accent", "اللون المميز"],
  "Your brand’s signature accent": [
    "La couleur signature de votre marque",
    "اللون الخاص بعلامتك التجارية",
  ],
  "Storefront language": ["Langue de la boutique", "لغة المتجر"],
  Currency: ["Devise", "العملة"],
  "Currency changes require an empty catalog.": [
    "Le changement de devise exige un catalogue vide.",
    "يتطلب تغيير العملة كتالوجاً فارغاً.",
  ],
  "Store URL": ["Adresse de la boutique", "رابط المتجر"],
  "Campaign heading": ["Titre de campagne", "عنوان الحملة"],
  "Campaign subtitle": ["Sous-titre de campagne", "العنوان الفرعي للحملة"],
  "Campaign image URL": ["Adresse de l’image de campagne", "رابط صورة الحملة"],
  "Use your own or licensed imagery. Paste an uploaded Media Library URL or an HTTPS image URL. Campaign videos and ordered sections are managed in Storefront Studio.":
    [
      "Utilisez vos images ou des images sous licence. Collez une adresse de la médiathèque ou une adresse HTTPS. Les vidéos et l’ordre des sections se gèrent dans le studio de boutique.",
      "استخدم صورك أو صوراً مرخصة. ألصق رابطاً من مكتبة الوسائط أو رابط HTTPS. تُدار فيديوهات الحملة وترتيب الأقسام في استوديو المتجر.",
    ],
  "Your brand settings are saved.": [
    "Les paramètres de votre marque sont enregistrés.",
    "تم حفظ إعدادات علامتك التجارية.",
  ],
  "Saving…": ["Enregistrement…", "جارٍ الحفظ…"],
  "Save brand settings": ["Enregistrer la marque", "حفظ إعدادات العلامة"],
  "CAMPAIGN PREVIEW": ["APERÇU DE CAMPAGNE", "معاينة الحملة"],
  "Campaign preview": ["Aperçu de campagne", "معاينة الحملة"],
  "Your locations": ["Vos établissements", "مواقعك"],
  of: ["sur", "من"],
  available: ["disponibles", "متاح"],
  records: ["entrées", "سجلات"],
  Page: ["Page", "الصفحة"],
  Previous: ["Précédent", "السابق"],
  Next: ["Suivant", "التالي"],
  "Add store": ["Ajouter un magasin", "إضافة متجر"],
  Active: ["Actif", "نشط"],
  STORE: ["Magasin", "متجر"],
  WAREHOUSE: ["Entrepôt", "مستودع"],
  "YOUR PLAN": ["VOTRE FORMULE", "خطتك"],
  "Manage paid periods and monthly renewal on this page. Plan limits apply to all operations.":
    [
      "Gérez les périodes payées et le renouvellement mensuel dans cette page. Les limites de votre formule s’appliquent à toutes les opérations.",
      "أدر الفترات المدفوعة والتجديد الشهري في هذه الصفحة. تسري حدود خطتك على جميع العمليات.",
    ],
  "A new location. More possibilities.": [
    "Un nouvel établissement. Plus de possibilités.",
    "موقع جديد. إمكانيات أكثر.",
  ],
  "Store name": ["Nom du magasin", "اسم المتجر"],
  City: ["Ville", "المدينة"],
  "Location type": ["Type d’établissement", "نوع الموقع"],
  "Retail store": ["Magasin de vente", "متجر بيع"],
  Warehouse: ["Entrepôt", "مستودع"],
  "Warehouses hold inventory but cannot accept checkout or pickup orders.": [
    "Les entrepôts stockent les articles sans accepter de ventes ou de commandes de retrait.",
    "تحتفظ المستودعات بالمخزون ولا تستقبل عمليات البيع أو طلبات الاستلام.",
  ],
  "Create store": ["Créer le magasin", "إنشاء متجر"],
  "Business reports": ["Rapports d’activité", "تقارير الأعمال"],
  "Retail operations": ["Opérations commerciales", "عمليات البيع"],
  "Media library": ["Médiathèque", "مكتبة الوسائط"],
  "Virtual fitting": ["Essayage virtuel", "غرفة القياس الافتراضية"],
  "Members club": ["Club des membres", "نادي الأعضاء"],
  "Cash registers": ["Caisses", "صناديق النقد"],
  Promotions: ["Promotions", "العروض"],
  "Customer campaigns": ["Campagnes clients", "حملات العملاء"],
  "Delivery & commerce": ["Livraison et commerce", "التوصيل والتجارة"],
  "Staff & access": ["Équipe et accès", "الموظفون والصلاحيات"],
  Support: ["Assistance", "الدعم"],
  "Close navigation": ["Fermer la navigation", "إغلاق القائمة"],
  "Open navigation": ["Ouvrir la navigation", "فتح القائمة"],
  "Workspace navigation": ["Navigation de l’espace", "قائمة مساحة العمل"],
  "Platform overview": ["Vue de la plateforme", "نظرة عامة على المنصة"],
  "Your workspace settings": [
    "Paramètres de votre espace",
    "إعدادات مساحة العمل",
  ],
  Workspace: ["Espace de travail", "مساحة العمل"],
  Platform: ["Plateforme", "المنصة"],
  "Search products": ["Rechercher des produits", "البحث عن المنتجات"],
  Language: ["Langue", "اللغة"],
  "Toggle theme": ["Changer de thème", "تغيير المظهر"],
  Help: ["Aide", "المساعدة"],
  "Connected to your workspace": [
    "Connecté à votre espace",
    "متصل بمساحة العمل",
  ],
  "A little guidance.": ["Quelques conseils.", "بعض الإرشادات."],
  "CONSIDERED COMMERCE.": ["UN COMMERCE RÉFLÉCHI.", "تجارة مدروسة."],
  "For the brands": ["Pour les marques", "للعلامات التجارية"],
  shaping: ["qui façonnent", "التي تصنع"],
  "what’s next.": ["l’avenir.", "المستقبل."],
  "Your collections, your customers, your world.": [
    "Vos collections, vos clients, votre univers.",
    "مجموعاتك وعملاؤك وعالمك.",
  ],
  "Beautifully connected.": ["Élégamment connectés.", "متصلة بانسجام."],
  "BUILT FOR FASHION. DESIGNED FOR YOU.": [
    "POUR LA MODE. PENSÉ POUR VOUS.",
    "للأزياء. مصممة من أجلك.",
  ],
  "YOUR NEXT CHAPTER": ["VOTRE PROCHAIN CHAPITRE", "فصلك القادم"],
  "Make it yours.": ["Créez votre univers.", "اجعلها مساحتك."],
  "Welcome back.": ["Heureux de vous revoir.", "مرحباً بعودتك."],
  "Create your boutique workspace.": [
    "Créez l’espace de votre boutique.",
    "أنشئ مساحة عمل متجرك.",
  ],
  "Sign in to your INNOVIA workspace.": [
    "Connectez-vous à votre espace INNOVIA.",
    "سجّل الدخول إلى مساحة INNOVIA.",
  ],
  "Your name": ["Votre nom", "اسمك"],
  "Business name": ["Nom de l’entreprise", "اسم النشاط التجاري"],
  "Email address": ["Adresse e-mail", "البريد الإلكتروني"],
  Password: ["Mot de passe", "كلمة المرور"],
  "Please wait…": ["Veuillez patienter…", "يرجى الانتظار…"],
  "Create workspace": ["Créer l’espace", "إنشاء مساحة العمل"],
  "Enter your workspace": ["Accéder à votre espace", "الدخول إلى مساحة العمل"],
  "Already have a workspace? Sign in": [
    "Vous avez déjà un espace ? Connectez-vous",
    "لديك مساحة عمل؟ سجّل الدخول",
  ],
  "New to INNOVIA? Create a workspace": [
    "Nouveau sur INNOVIA ? Créez un espace",
    "جديد في INNOVIA؟ أنشئ مساحة عمل",
  ],
  "Understand your next chapter.": [
    "Éclairez votre prochain chapitre.",
    "افهم خطواتك القادمة.",
  ],
  "Sales, stock and membership from your retail ledger.": [
    "Ventes, stock et fidélité issus de vos opérations.",
    "المبيعات والمخزون والعضوية من سجلات متجرك.",
  ],
  "BUSINESS REPORTS": ["RAPPORTS D’ACTIVITÉ", "تقارير الأعمال"],
  Period: ["Période", "الفترة"],
  Location: ["Établissement", "الموقع"],
  "All locations": ["Tous les établissements", "كل المواقع"],
  "7 days": ["7 jours", "7 أيام"],
  "30 days": ["30 jours", "30 يوماً"],
  "90 days": ["90 jours", "90 يوماً"],
  "365 days": ["365 jours", "365 يوماً"],
  "Net sales": ["Ventes nettes", "صافي المبيعات"],
  Refunds: ["Remboursements", "المبالغ المستردة"],
  "Inventory value": ["Valeur du stock", "قيمة المخزون"],
  "Gross merchandise margin": [
    "Marge brute sur marchandises",
    "هامش الربح الإجمالي للبضائع",
  ],
  "Historical cost snapshots are incomplete.": [
    "Les coûts historiques sont incomplets.",
    "بيانات التكلفة التاريخية غير مكتملة.",
  ],
  "From recorded transactions": [
    "D’après les transactions enregistrées",
    "من المعاملات المسجلة",
  ],
  "Explore the ledger": ["Explorer les opérations", "استكشاف السجلات"],
  "Report dimension": ["Ventilation du rapport", "تصنيف التقرير"],
  stores: ["Établissements", "المواقع"],
  categories: ["Catégories", "الفئات"],
  brands: ["Marques", "العلامات التجارية"],
  products: ["Produits", "المنتجات"],
  employees: ["Employés", "الموظفون"],
  inventory: ["Stock", "المخزون"],
  membership: ["Fidélité", "العضوية"],
  ai: ["IA", "الذكاء الاصطناعي"],
  "Product / SKU": ["Produit / SKU", "المنتج / رمز الصنف"],
  "On hand": ["Stock physique", "المخزون الفعلي"],
  Reserved: ["Réservé", "المحجوز"],
  Sold: ["Vendu", "المباع"],
  Reorder: ["À commander", "إعادة الطلب"],
  Value: ["Valeur", "القيمة"],
  "Low stock": ["Stock faible", "مخزون منخفض"],
  "Slow moving": ["Faible rotation", "بطيء الحركة"],
  Orders: ["Commandes", "الطلبات"],
  "Net units": ["Unités nettes", "صافي الوحدات"],
  "Goods sales": ["Ventes de marchandises", "مبيعات البضائع"],
  Margin: ["Marge", "الهامش"],
  members: ["Membres", "الأعضاء"],
  pointsOutstanding: ["Points disponibles", "النقاط المتاحة"],
  pointsEarned: ["Points gagnés", "النقاط المكتسبة"],
  pointsRedeemed: ["Points utilisés", "النقاط المستخدمة"],
  repeatMembers: ["Membres récurrents", "الأعضاء المتكررون"],
  "Goods sales excluding tax and delivery, less captured variant costs. Historical missing costs suppress margin.":
    [
      "Ventes de marchandises hors taxes et livraison, moins les coûts enregistrés des variantes. La marge n’est pas affichée si des coûts historiques manquent.",
      "مبيعات البضائع دون الضريبة والتوصيل، ناقص تكاليف الأصناف المسجلة. لا يُعرض الهامش عند غياب التكلفة التاريخية.",
    ],
  "Current variant cost; reorder suggestions use the selected sales period and 14 days of demand.":
    [
      "Coût actuel des variantes ; les suggestions de réapprovisionnement utilisent la période sélectionnée et 14 jours de demande.",
      "التكلفة الحالية للصنف؛ تستخدم اقتراحات إعادة الطلب فترة المبيعات المختارة وطلب 14 يوماً.",
    ],
  "Count discrepancies": ["Écarts d’inventaire", "فروق جرد المخزون"],
  "MEDIA LIBRARY": ["BIBLIOTHÈQUE D’IMAGES", "مكتبة الصور"],
  "Images that tell your story.": [
    "Des images qui racontent votre histoire.",
    "صور تروي قصتك.",
  ],
  "Upload licensed images for products and campaigns. Images are resized and location metadata is removed.":
    [
      "Importez des images autorisées pour vos produits et campagnes. Elles sont redimensionnées et leurs données de localisation sont supprimées.",
      "ارفع صوراً مرخّصة للمنتجات والحملات. يُعدّل حجم الصور وتُحذف بيانات الموقع منها.",
    ],
  "Upload image": ["Importer une image", "رفع صورة"],
  "Processing…": ["Traitement…", "جارٍ المعالجة…"],
  KB: ["Ko", "ك.ب."],
  "Uploaded boutique asset": [
    "Image importée de la boutique",
    "صورة مرفوعة للمتجر",
  ],
  "Image URL": ["Adresse de l’image", "رابط الصورة"],
  "Copy URL": ["Copier le lien", "نسخ الرابط"],
  "Delete unused": ["Supprimer l’image inutilisée", "حذف الصورة غير المستخدمة"],
  "Upload your first product or campaign image.": [
    "Importez votre première image de produit ou de campagne.",
    "ارفع أول صورة لمنتج أو حملة.",
  ],
  "Image uploaded. Copy its URL into a product or storefront section.": [
    "Image importée. Copiez son lien dans un produit ou une section de la boutique.",
    "رُفعت الصورة. انسخ رابطها إلى منتج أو قسم من واجهة المتجر.",
  ],
  "Unused image removed.": [
    "Image inutilisée supprimée.",
    "حُذفت الصورة غير المستخدمة.",
  ],
  "Image URL copied.": ["Lien de l’image copié.", "نُسخ رابط الصورة."],
  "Select the image URL above and copy it.": [
    "Sélectionnez le lien ci-dessus et copiez-le.",
    "حدّد رابط الصورة أعلاه وانسخه.",
  ],
  "Choose a JPEG, PNG or WebP image up to 10 MB.": [
    "Choisissez une image JPEG, PNG ou WebP de 10 Mo maximum.",
    "اختر صورة JPEG أو PNG أو WebP بحجم أقصى 10 ميغابايت.",
  ],
  "Upload failed.": ["L’importation a échoué.", "تعذّر رفع الصورة."],
  "Too many requests. Please wait and try again.": [
    "Trop de requêtes. Patientez avant de réessayer.",
    "طلبات كثيرة جداً. انتظر ثم حاول مرة أخرى.",
  ],
  "Media storage is temporarily unavailable.": [
    "Le stockage des images est temporairement indisponible.",
    "تخزين الصور غير متاح مؤقتاً.",
  ],
  "This image reference already exists. Please upload the image again.": [
    "Cette référence d’image existe déjà. Importez à nouveau l’image.",
    "مرجع الصورة موجود بالفعل. ارفع الصورة مرة أخرى.",
  ],
  "Your boutique’s media storage is full. Remove unused images or contact the operator.":
    [
      "Le stockage d’images de votre boutique est plein. Supprimez les images inutilisées ou contactez l’opérateur.",
      "مساحة صور متجرك ممتلئة. احذف الصور غير المستخدمة أو تواصل مع المشغّل.",
    ],
  "Remove this image from products and draft/published campaigns before deleting it.":
    [
      "Retirez cette image des produits et des campagnes publiées ou en brouillon avant de la supprimer.",
      "أزل هذه الصورة من المنتجات والحملات المنشورة أو المسودات قبل حذفها.",
    ],
};
export function registerTranslations(
  entries: Record<string, readonly [string, string]>,
) {
  for (const [key, value] of Object.entries(entries))
    if (!Object.hasOwn(translations, key)) translations[key] = value;
}
export function translate(locale: string, value: string) {
  if (locale !== "fr" && locale !== "ar") return value;
  const index = locale === "ar" ? 1 : 0;
  if (Object.hasOwn(translations, value)) return translations[value]![index];
  const stockError = value.match(/^(.+) has insufficient available stock\.$/s);
  if (stockError)
    return translations["{variant} has insufficient available stock."]![
      index
    ].replace("{variant}", () => stockError[1]!);
  // Translate known validation messages without dropping their field context.
  const fields: Record<string, string> = {
    name: "Name",
    value: "Value",
    startsAt: "Starts at",
    endsAt: "Ends at",
  };
  return value
    .split(" · ")
    .map((issue) => {
      const match = issue.match(
        /^((?:[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)?): (.+)$/s,
      );
      if (!match || !Object.hasOwn(translations, match[2]!)) return issue;
      const field = Object.hasOwn(fields, match[1]!)
        ? (translations[fields[match[1]!]!]?.[index] ?? match[1]!)
        : match[1]!;
      return `${field ? `${field}: ` : ""}${translations[match[2]!]![index]}`;
    })
    .join(" · ");
}
export function useWords() {
  const locale = usePreferences((s) => s.locale);
  return (value: string) => translate(locale, value);
}
