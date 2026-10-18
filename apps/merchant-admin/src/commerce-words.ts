import { registerTranslations, useWords } from "./words";

export const commerceTranslations: Record<string, readonly [string, string]> = {
  "EVERY DIRHAM ACCOUNTED FOR": [
    "CHAQUE DIRHAM EST COMPTABILISÉ",
    "كل درهم محسوب",
  ],
  "Cash registers.": ["Caisses.", "صناديق النقد."],
  "Opening float, cash movements and a considered close.": [
    "Fond de caisse, mouvements d’espèces et clôture vérifiée.",
    "رصيد الافتتاح وحركات النقد والإغلاق المتحقق منه.",
  ],
  "Require an open register for cash sales, pickup payments and refunds": [
    "Exiger une caisse ouverte pour les ventes en espèces, les retraits et les remboursements",
    "اشتراط صندوق مفتوح للمبيعات النقدية ودفع طلبات الاستلام والمبالغ المستردة",
  ],
  "Courier cash on delivery settlements stay outside the boutique cash drawer.":
    [
      "Les règlements du transporteur pour les livraisons contre remboursement restent hors de la caisse de la boutique.",
      "تبقى تسويات الدفع عند التسليم لدى شركة التوصيل خارج صندوق المتجر.",
    ],
  "Open a register": ["Ouvrir une caisse", "فتح صندوق نقد"],
  Store: ["Magasin", "المتجر"],
  "Opening cash": ["Fond de caisse", "رصيد الافتتاح"],
  "Open register": ["Ouvrir la caisse", "فتح الصندوق"],
  Sessions: ["Sessions", "الجلسات"],
  Closed: ["Fermée", "مغلقة"],
  "Open session": ["Ouverte", "مفتوحة"],
  "Select a cash session to review its ledger.": [
    "Choisissez une session de caisse pour consulter son journal.",
    "اختر جلسة صندوق لمراجعة سجلها.",
  ],
  "Expected cash:": ["Espèces attendues :", "النقد المتوقع:"],
  Counted: ["Compté", "المبلغ المعدود"],
  Variance: ["Écart", "الفرق"],
  "Cash movement": ["Mouvement d’espèces", "حركة نقد"],
  Direction: ["Sens", "الاتجاه"],
  "Cash in": ["Entrée d’espèces", "إدخال نقد"],
  "Cash out": ["Sortie d’espèces", "إخراج نقد"],
  Amount: ["Montant", "المبلغ"],
  "Record movement": ["Enregistrer le mouvement", "تسجيل الحركة"],
  "Count & close": ["Compter et clôturer", "العد والإغلاق"],
  "Counted cash": ["Espèces comptées", "النقد المعدود"],
  "Closing note": ["Note de clôture", "ملاحظة الإغلاق"],
  "Close register & record variance": [
    "Clôturer la caisse et enregistrer l’écart",
    "إغلاق الصندوق وتسجيل الفرق",
  ],
  "Latest 200 movements": ["Les 200 derniers mouvements", "آخر 200 حركة"],
  "Cash OPENING": ["Ouverture", "افتتاح"],
  "Cash IN": ["Entrée", "إدخال"],
  "Cash OUT": ["Sortie", "إخراج"],
  "Cash SALE": ["Vente", "بيع"],
  "Cash REFUND": ["Remboursement", "استرداد"],
  "Opening float": ["Fond de caisse initial", "رصيد افتتاح الصندوق"],
  "Cashier performance · last 30 days": [
    "Activité des caissiers · 30 derniers jours",
    "أداء أمناء الصناديق · آخر 30 يوماً",
  ],
  "A REASON TO RETURN": ["UNE RAISON DE REVENIR", "سبب للعودة"],
  "Promotions.": ["Promotions.", "العروض."],
  "Scheduled codes for your boutique and online collection.": [
    "Des codes programmés pour votre magasin et votre boutique en ligne.",
    "رموز مجدولة لمتجرك وتشكيلتك الإلكترونية.",
  ],
  "Create a promotion": ["Créer une promotion", "إنشاء عرض"],
  "Campaign name": ["Nom de la campagne", "اسم الحملة"],
  "Discount type": ["Type de remise", "نوع الخصم"],
  Percentage: ["Pourcentage", "نسبة مئوية"],
  "Fixed amount": ["Montant fixe", "مبلغ ثابت"],
  Value: ["Valeur", "القيمة"],
  "Minimum basket": ["Panier minimum", "الحد الأدنى للسلة"],
  Channel: ["Canal", "القناة"],
  ALL: ["Tous les canaux", "كل القنوات"],
  POS: ["Point de vente", "نقطة البيع"],
  ONLINE: ["En ligne", "إلكتروني"],
  "Total uses": ["Nombre d’utilisations", "عدد الاستخدامات"],
  "Starts at": ["Début", "البداية"],
  "Ends at": ["Fin", "النهاية"],
  "Create promotion": ["Créer la promotion", "إنشاء العرض"],
  "Prices include tax. The discount applies to goods before delivery fees. One code or reward voucher per order; cancelled reservations release their reserved use.":
    [
      "Les prix incluent les taxes. La remise s’applique aux articles avant les frais de livraison. Un code ou bon par commande ; l’annulation d’une réservation libère l’utilisation du code.",
      "تشمل الأسعار الضريبة. يُطبق الخصم على السلع قبل رسوم التوصيل. رمز أو قسيمة واحدة لكل طلب؛ يؤدي إلغاء الحجز إلى تحرير الاستخدام المحجوز.",
    ],
  "Your latest 100 promotions": [
    "Vos 100 dernières promotions",
    "آخر 100 عرض لك",
  ],
  uses: ["utilisations", "استخدامات"],
  Minimum: ["Minimum", "الحد الأدنى"],
  Enabled: ["Activée", "مفعّل"],
  Paused: ["En pause", "متوقف مؤقتاً"],
  Pause: ["Mettre en pause", "إيقاف مؤقت"],
  Enable: ["Activer", "تفعيل"],
  "Every order tells a story.": [
    "Chaque commande raconte une histoire.",
    "كل طلب يروي قصة.",
  ],
  "From the first click to the final handover. Keep it all in view.": [
    "Du premier clic à la remise au client. Gardez une vue d’ensemble.",
    "من أول نقرة إلى التسليم النهائي. تابع كل التفاصيل.",
  ],
  COMMERCE: ["COMMANDES", "الطلبات"],
  Order: ["Commande", "الطلب"],
  Customer: ["Client", "العميل"],
  "Export page": ["Exporter la page", "تصدير الصفحة"],
  "All orders": ["Toutes les commandes", "كل الطلبات"],
  "Manage order": ["Gérer la commande", "إدارة الطلب"],
  "Order / customer": ["Commande / client", "الطلب / العميل"],
  "In store": ["En magasin", "في المتجر"],
  Online: ["En ligne", "إلكتروني"],
  completed: ["terminée", "مكتمل"],
  pending: ["en attente", "قيد الانتظار"],
  cancelled: ["annulée", "ملغى"],
  refunded: ["remboursée", "مسترد"],
  partially_refunded: ["partiellement remboursée", "مسترد جزئياً"],
  in_fulfilment: ["en livraison", "قيد التوصيل"],
  expired: ["expirée", "منتهي"],
  COMPLETED: ["Terminée", "مكتمل"],
  CANCELLED: ["Annulée", "ملغى"],
  REFUNDED: ["Remboursée", "مسترد"],
  PARTIALLY_REFUNDED: ["Partiellement remboursée", "مسترد جزئياً"],
  IN_FULFILMENT: ["En livraison", "قيد التوصيل"],
  EXPIRED: ["Expirée", "منتهي"],
  "Your first order starts here.": [
    "Votre première commande commence ici.",
    "طلبك الأول يبدأ هنا.",
  ],
  "Sales will appear as your boutique grows.": [
    "Vos ventes apparaîtront au fil de l’activité de votre boutique.",
    "ستظهر المبيعات مع نمو نشاط متجرك.",
  ],
  "Delivery:": ["Livraison :", "التوصيل:"],
  "Included tax": ["Taxe incluse", "الضريبة المشمولة"],
  "Refunded:": ["Remboursé :", "المبلغ المسترد:"],
  "Delivery & payment confirmed": [
    "Livraison et paiement confirmés",
    "تم تأكيد التوصيل والدفع",
  ],
  "Payment collected & fulfilled": [
    "Paiement reçu et commande remise",
    "تم استلام الدفع وتسليم الطلب",
  ],
  "Cancel & release stock": [
    "Annuler et libérer le stock",
    "إلغاء وتحرير المخزون",
  ],
  "Confirm that the remaining refundable cash amount has been returned and every item is back in sellable condition. Delivery fees follow the policy saved on this order.":
    [
      "Confirmez que le montant remboursable restant a été rendu et que tous les articles sont de nouveau vendables. Les frais de livraison suivent la politique enregistrée sur cette commande.",
      "أكّد إعادة المبلغ النقدي القابل للاسترداد وأن جميع القطع عادت بحالة قابلة للبيع. تتبع رسوم التوصيل السياسة المحفوظة لهذا الطلب.",
    ],
  "Record full cash reversal & restock": [
    "Enregistrer le remboursement intégral et remettre en stock",
    "تسجيل الاسترداد النقدي الكامل وإعادة المخزون",
  ],
  "Partial return or size exchange": [
    "Retour partiel ou échange de taille",
    "إرجاع جزئي أو تبديل المقاس",
  ],
  "Return recorded.": ["Retour enregistré.", "تم تسجيل الإرجاع."],
  "Return or exchange": ["Retour ou échange", "إرجاع أو تبديل"],
  "Returned value:": ["Valeur retournée :", "قيمة السلع المرتجعة:"],
  "Additional cash collected": [
    "Complément d’espèces reçu",
    "النقد الإضافي المستلم",
  ],
  "Cash returned to customer": [
    "Espèces rendues au client",
    "النقد المعاد للعميل",
  ],
  "No cash difference": ["Aucune différence d’espèces", "لا يوجد فرق نقدي"],
  "Back to orders": ["Retour aux commandes", "العودة إلى الطلبات"],
  "Select the units physically returned. Mark restock only for items in sellable condition.":
    [
      "Sélectionnez les unités effectivement retournées. Remettez en stock uniquement les articles vendables.",
      "اختر الوحدات المرتجعة فعلياً. أعد إلى المخزون القطع القابلة للبيع فقط.",
    ],
  "Returnable units": [
    "Unités pouvant être retournées",
    "الوحدات القابلة للإرجاع",
  ],
  Units: ["Unités", "الوحدات"],
  "Return units": ["Unités retournées", "الوحدات المرتجعة"],
  "Restock sellable units": [
    "Remettre les unités vendables en stock",
    "إعادة الوحدات القابلة للبيع إلى المخزون",
  ],
  "Exchange for a replacement": [
    "Échanger contre un autre article",
    "التبديل بقطعة بديلة",
  ],
  "Find a replacement": [
    "Rechercher un article de remplacement",
    "البحث عن قطعة بديلة",
  ],
  "Replacement SKU": ["SKU de remplacement", "رمز SKU البديل"],
  "Choose a variant": ["Choisir une variante", "اختر خياراً"],
  "Replacement quantity": ["Quantité de remplacement", "كمية الاستبدال"],
  "Collect additional cash": [
    "Encaisser le complément",
    "استلام النقد الإضافي",
  ],
  "Return cash to customer": [
    "Rendre les espèces au client",
    "إعادة النقد للعميل",
  ],
  "The displayed cash difference has been settled with the customer.": [
    "La différence d’espèces affichée a été réglée avec le client.",
    "تمت تسوية الفرق النقدي المعروض مع العميل.",
  ],
  "Recording…": ["Enregistrement…", "جارٍ التسجيل…"],
  "Record exchange": ["Enregistrer l’échange", "تسجيل التبديل"],
  "Record partial return": [
    "Enregistrer le retour partiel",
    "تسجيل الإرجاع الجزئي",
  ],
  "Arrange delivery": ["Organiser la livraison", "ترتيب التوصيل"],
  "Delivery in progress": ["Livraison en cours", "التوصيل جارٍ"],
  Carrier: ["Transporteur", "شركة التوصيل"],
  "Tracking reference": ["Référence de suivi", "مرجع التتبع"],
  "These pieces have been handed to the carrier.": [
    "Ces articles ont été remis au transporteur.",
    "تم تسليم هذه القطع لشركة التوصيل.",
  ],
  "Delivery failed and every piece has been returned in sellable condition. No payment was collected.":
    [
      "La livraison a échoué et tous les articles sont revenus en état vendable. Aucun paiement n’a été reçu.",
      "فشل التوصيل وعادت جميع القطع بحالة قابلة للبيع. لم يتم استلام أي دفع.",
    ],
  "Record dispatch": ["Enregistrer l’expédition", "تسجيل الإرسال"],
  "Record failed delivery & restock": [
    "Enregistrer l’échec de livraison et remettre en stock",
    "تسجيل فشل التوصيل وإعادة المخزون",
  ],
  "CUSTOMER DIRECTORY": ["RÉPERTOIRE CLIENTS", "دليل العملاء"],
  "More than customers. Your community.": [
    "Plus que des clients. Votre communauté.",
    "أكثر من عملاء. مجتمعك.",
  ],
  "The people behind every purchase, brought together.": [
    "Retrouvez les personnes derrière chaque achat.",
    "اجمع الأشخاص وراء كل عملية شراء.",
  ],
  "Search customers": ["Rechercher des clients", "البحث عن العملاء"],
  "Search by name or email…": [
    "Rechercher par nom ou e-mail…",
    "ابحث بالاسم أو البريد…",
  ],
  Phone: ["Téléphone", "الهاتف"],
  Joined: ["Inscription", "تاريخ الانضمام"],
  "Your community starts with one connection.": [
    "Votre communauté commence par une rencontre.",
    "مجتمعك يبدأ بتواصل واحد.",
  ],
  "Customers appear when an order includes an email address.": [
    "Les clients apparaissent lorsqu’une commande contient une adresse e-mail.",
    "يظهر العملاء عندما يتضمن الطلب بريداً إلكترونياً.",
  ],
  "Customer profile": ["Fiche client", "ملف العميل"],
  "Recorded customer value": [
    "Valeur client enregistrée",
    "قيمة العميل المسجّلة",
  ],
  "Recorded fulfilled sales less refunds; this is historical value, not a prediction.":
    [
      "Ventes terminées enregistrées, moins les remboursements. Il s’agit d’une valeur historique, pas d’une prévision.",
      "المبيعات المكتملة المسجّلة ناقص المبالغ المستردة. هذه قيمة تاريخية وليست توقعاً.",
    ],
  "Repeat customer": ["Client récurrent", "عميل متكرر"],
  "First purchase or new customer": [
    "Premier achat ou nouveau client",
    "شراء أول أو عميل جديد",
  ],
  "Recorded fulfilled purchases": [
    "Achats terminés enregistrés",
    "عمليات الشراء المكتملة المسجّلة",
  ],
  "Stores visited": ["Magasins visités", "المتاجر التي تمت زيارتها"],
  "Membership & consent": ["Adhésion et consentement", "العضوية والموافقة"],
  "Not enrolled.": ["Non inscrit.", "غير مشترك."],
  "Opted in": ["Consentement donné", "تمت الموافقة"],
  "Opted out": ["Consentement refusé", "تم الرفض"],
  "account terms": ["Conditions du compte", "شروط الحساب"],
  "email marketing": ["Marketing par e-mail", "التسويق بالبريد"],
  "in app marketing": ["Marketing dans l’application", "التسويق داخل التطبيق"],
  "sms marketing": ["Marketing par SMS", "التسويق بالرسائل النصية"],
  "push marketing": ["Notifications marketing", "إشعارات التسويق"],
  "Shopping preferences": ["Préférences d’achat", "تفضيلات التسوق"],
  "Sizes:": ["Tailles :", "المقاسات:"],
  "Categories:": ["Catégories :", "الفئات:"],
  "Not supplied": ["Non renseigné", "غير محدد"],
  "Not supplied by the customer.": [
    "Non renseigné par le client.",
    "لم يحدده العميل.",
  ],
  "Manager notes": ["Notes du responsable", "ملاحظات المسؤول"],
  Notes: ["Notes", "الملاحظات"],
  Points: ["Points", "النقاط"],
  "Save private notes": [
    "Enregistrer les notes privées",
    "حفظ الملاحظات الخاصة",
  ],
  "Purchase history": ["Historique des achats", "سجل المشتريات"],
  "Only fulfilled sales with remaining units can be returned.": [
    "Seules les ventes terminées avec des unités restantes peuvent être retournées.",
    "يمكن إرجاع المبيعات المكتملة التي تتبقى فيها وحدات فقط.",
  ],
  "Each return line may appear once.": [
    "Chaque ligne de retour ne peut apparaître qu’une fois.",
    "يجب إدراج كل سطر إرجاع مرة واحدة فقط.",
  ],
  "The requested units have already been returned or exceed the sale.": [
    "Les unités demandées ont déjà été retournées ou dépassent la vente.",
    "الوحدات المطلوبة أُرجعت بالفعل أو تتجاوز الكمية المباعة.",
  ],
  "The cash amount has changed. Refresh the order and replacement prices before recording the exchange.":
    [
      "Le montant a changé. Actualisez la commande et les prix de remplacement avant d’enregistrer l’échange.",
      "تغيّر المبلغ النقدي. حدّث الطلب وأسعار البدائل قبل تسجيل التبديل.",
    ],
  "This movement exceeds the register’s available cash or supported balance.": [
    "Ce mouvement dépasse les espèces disponibles ou le solde maximal de la caisse.",
    "تتجاوز هذه الحركة النقد المتاح أو الحد الأقصى لرصيد الصندوق.",
  ],
  "This store already has an open cash register.": [
    "Ce magasin possède déjà une caisse ouverte.",
    "يوجد صندوق مفتوح لهذا المتجر بالفعل.",
  ],
  "Choose a positive cash amount.": [
    "Choisissez un montant d’espèces positif.",
    "اختر مبلغاً نقدياً موجباً.",
  ],
  "Only the opening cashier or a manager can close this register.": [
    "Seul le caissier ayant ouvert la caisse ou un responsable peut la clôturer.",
    "يمكن لأمين الصندوق الذي فتحه أو للمسؤول فقط إغلاق هذا الصندوق.",
  ],
  "Choose another promotion code.": [
    "Choisissez un autre code promotionnel.",
    "اختر رمز عرض آخر.",
  ],
  "Choose a positive value, up to 100 for a percentage.": [
    "Choisissez une valeur positive, jusqu’à 100 pour un pourcentage.",
    "اختر قيمة موجبة لا تتجاوز 100 للنسبة المئوية.",
  ],
  "The end must be after the start.": [
    "La fin doit être postérieure au début.",
    "يجب أن تكون النهاية بعد البداية.",
  ],
};

// Lazy operational pages register their vocabulary before rendering notices or labels.
registerTranslations(commerceTranslations);
export { useWords as useCommerceWords };
