export const translations = {
  nl: {
    // Navigation
    receipts:    'Bonnen',
    new_receipt: 'Nieuwe Bon',
    products:    'Producten',

    // General
    save:           'Opslaan',
    cancel:         'Annuleren',
    delete:         'Verwijderen',
    edit:           'Bewerken',
    back:           'Terug',
    confirm_delete: 'Weet je zeker dat je dit wilt verwijderen?',
    loading:        'Laden…',
    print:          'Afdrukken',
    close:          'Sluiten',

    // Offline
    offline_banner: 'Geen verbinding — wijzigingen worden mogelijk niet opgeslagen',

    // Products
    product_name:  'Naam',
    product_price: 'Prijs (€)',
    add_product:   'Product toevoegen',
    no_products:   'Nog geen producten. Voeg er een toe!',

    // Receipts list
    all:            'Alle',
    paid:           'Betaald',
    unpaid:         'Onbetaald',
    no_receipts:    'Geen bonnen gevonden.',
    receipt_number: 'Bon',
    items:          'artikelen',
    total:          'Totaal',
    mark_paid:      'Markeer betaald',
    mark_unpaid:    'Markeer onbetaald',
    delete_receipt: 'Bon verwijderen',
    search_receipts:'Zoek op naam of nummer…',
    sort_date:      'Datum',
    sort_name:      'Naam',
    sort_amount:    'Bedrag',

    // Bulk select
    select_mode:    'Selecteer',
    select_cancel:  'Annuleer',
    bulk_mark_paid: 'Markeer betaald',
    bulk_selected:  'geselecteerd',

    // Toasts
    toast_marked_paid:   'Bon gemarkeerd als betaald',
    toast_marked_unpaid: 'Bon gemarkeerd als onbetaald',
    toast_deleted:       'Verwijderd',
    toast_saved:         'Opgeslagen',
    toast_no_access:     'Geen toegang — beheerder vereist',

    // New receipt
    receipt_name_label:       'Naam / Tafelnummer (optioneel)',
    receipt_name_placeholder: 'Bijv. Tafel 3 of Jan',
    select_products:          'Selecteer producten',
    order_summary:            'Bestelling',
    no_items_selected:        'Nog geen producten geselecteerd',
    create_receipt:           'Bon aanmaken',
    no_products_hint:         'Geen producten beschikbaar. Voeg eerst producten toe.',
    quick_select:             'Snelkeuze',

    // Receipt detail
    add_more:     'Meer toevoegen',
    qty:          'Aantal',
    price:        'Stukprijs',
    subtotal:     'Subtotaal',
    created:      'Aangemaakt op',
    no_items:     'Geen artikelen op deze bon.',
    edit_name:    'Naam bewerken',
    discount:     'Korting',
    discount_pct: 'Korting (%)',
    discount_amt: 'Kortingsbedrag',
    original:     'Subtotaal',

    // Wisselgeld
    change_calc:  'Wisselgeld',
    received:     'Ontvangen (€)',
    change:       'Wisselgeld',
    change_exact: 'Exact betaald',

    // Kiosk
    kiosk_mode: 'Klantenscherm',
    kiosk_back: 'Terug naar kassa',

    // Login
    login_heading:    'Welkom terug',
    login_sub:        'Voer de PIN in om door te gaan',
    login_placeholder:'PIN',
    login_submit:     'Inloggen',
    login_error:      'Verkeerde PIN. Probeer opnieuw.',
    logout:           'Uitloggen',

    // Categories
    category:         'Categorie',
    cat_pannenkoeken: 'Pannenkoeken',
    cat_beleg:        'Beleg',
    cat_drinken:      'Drinken',
    cat_overig:       'Overig',

    // Overview / stats
    overview:           'Overzicht',
    stats_total:        'Totale omzet',
    stats_today:        'Vandaag',
    stats_paid_amt:     'Betaald',
    stats_unpaid_amt:   'Openstaand',
    stats_count:        'Bonnen',
    stats_avg:          'Gem. bon',
    stats_by_hour:      'Omzet per uur — vandaag',
    stats_by_day:       'Omzet per dag',
    stats_top:          'Populairste producten',
    stats_revenue:      'Omzet',
    stats_qty:          'Stuks verkocht',
    stats_empty:        'Nog geen data. Maak eerst bonnen aan.',
    stats_period_all:   'Alle tijd',
    stats_period_today: 'Vandaag',
    export_csv:         'Exporteer CSV',
    dag_rapport:        'Dag rapport',
    dag_rapport_title:  'Dagoverzicht',

    // Settings
    settings:                 'Instellingen',
    settings_language:        'Taal',
    settings_payment_section: 'Betaalverzoek',
    settings_payment_url:     'Betaallink (URL)',
    settings_payment_url_ph:  'https://www.ing.nl/payreq/...',
    settings_payment_name:    'Beschrijving',
    settings_payment_name_ph: 'Bijv. Sint Martinus Explos',
    settings_payment_preview: 'Voorbeeld',
    settings_appearance:      'Weergave',
    dark_mode:                'Donkere modus',
    settings_roles:           'Rollen',
    role_admin:               'Beheerder',
    role_cashier:             'Kassier',
    your_role:                'Jouw rol',
    cashier_pin_hint:         'Stel een kassier-PIN in via .env: CASHIER_PIN=jouw_pin',

    // Payment request
    payment_title:  'Betaalverzoek',
    payment_hint:   'Scan de QR-code of deel de link met de klant.',
    payment_open:   'Open betaallink',
    payment_copy:   'Kopieer link',
    payment_copied: 'Gekopieerd!',
    payment_btn:    'Betaalverzoek',
  },

  en: {
    // Navigation
    receipts:    'Receipts',
    new_receipt: 'New Receipt',
    products:    'Products',

    // General
    save:           'Save',
    cancel:         'Cancel',
    delete:         'Delete',
    edit:           'Edit',
    back:           'Back',
    confirm_delete: 'Are you sure you want to delete this?',
    loading:        'Loading…',
    print:          'Print',
    close:          'Close',

    // Offline
    offline_banner: 'No connection — changes may not be saved',

    // Products
    product_name:  'Name',
    product_price: 'Price (€)',
    add_product:   'Add product',
    no_products:   'No products yet. Add one!',

    // Receipts list
    all:            'All',
    paid:           'Paid',
    unpaid:         'Unpaid',
    no_receipts:    'No receipts found.',
    receipt_number: 'Receipt',
    items:          'items',
    total:          'Total',
    mark_paid:      'Mark as paid',
    mark_unpaid:    'Mark as unpaid',
    delete_receipt: 'Delete receipt',
    search_receipts:'Search by name or number…',
    sort_date:      'Date',
    sort_name:      'Name',
    sort_amount:    'Amount',

    // Bulk select
    select_mode:    'Select',
    select_cancel:  'Cancel',
    bulk_mark_paid: 'Mark as paid',
    bulk_selected:  'selected',

    // Toasts
    toast_marked_paid:   'Receipt marked as paid',
    toast_marked_unpaid: 'Receipt marked as unpaid',
    toast_deleted:       'Deleted',
    toast_saved:         'Saved',
    toast_no_access:     'No access — admin required',

    // New receipt
    receipt_name_label:       'Name / Table number (optional)',
    receipt_name_placeholder: 'E.g. Table 3 or John',
    select_products:          'Select products',
    order_summary:            'Order',
    no_items_selected:        'No products selected yet',
    create_receipt:           'Create receipt',
    no_products_hint:         'No products available. Add products first.',
    quick_select:             'Quick select',

    // Receipt detail
    add_more:     'Add more',
    qty:          'Qty',
    price:        'Unit price',
    subtotal:     'Subtotal',
    created:      'Created at',
    no_items:     'No items on this receipt.',
    edit_name:    'Edit name',
    discount:     'Discount',
    discount_pct: 'Discount (%)',
    discount_amt: 'Discount amount',
    original:     'Subtotal',

    // Wisselgeld
    change_calc:  'Change',
    received:     'Received (€)',
    change:       'Change',
    change_exact: 'Exact amount',

    // Kiosk
    kiosk_mode: 'Customer display',
    kiosk_back: 'Back to cashier',

    // Login
    login_heading:    'Welcome back',
    login_sub:        'Enter the PIN to continue',
    login_placeholder:'PIN',
    login_submit:     'Sign in',
    login_error:      'Wrong PIN. Please try again.',
    logout:           'Sign out',

    // Categories
    category:         'Category',
    cat_pannenkoeken: 'Pancakes',
    cat_beleg:        'Toppings',
    cat_drinken:      'Drinks',
    cat_overig:       'Other',

    // Overview / stats
    overview:           'Overview',
    stats_total:        'Total revenue',
    stats_today:        'Today',
    stats_paid_amt:     'Paid',
    stats_unpaid_amt:   'Outstanding',
    stats_count:        'Receipts',
    stats_avg:          'Avg. receipt',
    stats_by_hour:      'Revenue per hour — today',
    stats_by_day:       'Revenue per day',
    stats_top:          'Most popular products',
    stats_revenue:      'Revenue',
    stats_qty:          'Units sold',
    stats_empty:        'No data yet. Create some receipts first.',
    stats_period_all:   'All time',
    stats_period_today: 'Today',
    export_csv:         'Export CSV',
    dag_rapport:        'Day report',
    dag_rapport_title:  'Daily overview',

    // Settings
    settings:                 'Settings',
    settings_language:        'Language',
    settings_payment_section: 'Payment request',
    settings_payment_url:     'Payment link (URL)',
    settings_payment_url_ph:  'https://www.ing.nl/payreq/...',
    settings_payment_name:    'Description',
    settings_payment_name_ph: 'E.g. Sint Martinus Explos',
    settings_payment_preview: 'Preview',
    settings_appearance:      'Appearance',
    dark_mode:                'Dark mode',
    settings_roles:           'Roles',
    role_admin:               'Admin',
    role_cashier:             'Cashier',
    your_role:                'Your role',
    cashier_pin_hint:         'Set a cashier PIN via .env: CASHIER_PIN=your_pin',

    // Payment request
    payment_title:  'Payment request',
    payment_hint:   'Scan the QR code or share the link with the customer.',
    payment_open:   'Open payment link',
    payment_copy:   'Copy link',
    payment_copied: 'Copied!',
    payment_btn:    'Payment request',
  },
}
