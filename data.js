// -------------------- 12-tier Rarity System --------------------

export const RARITIES = [
  { id:"consumer",      label:"Consumer",      color:"#D3D3D3", corner:0, min:  8,  max: 12 },
  { id:"industrial",    label:"Industrial",    color:"#708090", corner:0, min: 12,  max: 16 },

  { id:"mil_spec",      label:"Mil-Spec",      color:"#8FAD23", corner:1, min: 16,  max: 22 },
  { id:"tactical",      label:"Tactical",      color:"#6D8E23", corner:1, min: 22,  max: 28 },

  { id:"restricted",    label:"Restricted",    color:"#46A3B4", corner:2, min: 28,  max: 36 },
  { id:"classified",    label:"Classified",    color:"#4154E1", corner:2, min: 36,  max: 44 },

  { id:"seraph",        label:"Seraph",        color:"#8A2BE2", corner:3, min: 44,  max: 55 },
  { id:"ultra",         label:"Ultra",         color:"#800080", corner:3, min: 55,  max: 66 },

  { id:"exotic",        label:"Exotic",        color:"#FFD700", corner:4, min: 66,  max: 78 },
  { id:"extraordinary", label:"Extraordinary", color:"#DC143C", corner:4, min: 78,  max: 90 },

  { id:"pearlescent",   label:"Pearlescent",   color:"#DBDBDB", corner:5, min: 90,  max:105 },
  { id:"effervescent",  label:"Effervescent",  color:"#333333", corner:5, min:105,  max:120 },
];

// -------------------- Cosmetic Rarity System --------------------

export const STARS = [
    {id:"stars_1", label:"★☆☆☆☆", key:"Crude",             color:"rgba(170,180,200,.55)"},
    {id:"stars_2", label:"★★☆☆☆", key:"Basic",             color:"rgba(120,255,170,.55)"},
    {id:"stars_3", label:"★★★☆☆", key:"Standard",          color:"rgba(120,190,255,.70)"},
    {id:"stars_4", label:"★★★★☆", key:"Refined",           color:"rgba(190,120,255,.65)"},
    {id:"stars_5", label:"★★★★★", key:"Mastercrafted",     color:"rgba(255,190,120,.70)"},
];

export const RATING = [
    {id:"rating_6", label:"SS",  key:"Exceptional",          color:"rgba(255,190,120,.70)"},
    {id:"rating_5", label:"S",   key:"Excellent",            color:"rgba(190,120,255,.65)"},
    {id:"rating_4", label:"A",   key:"Strong",               color:"rgba(120,190,255,.70)"},
    {id:"rating_3", label:"B",   key:"Average",              color:"rgba(120,255,170,.55)"},
    {id:"rating_2", label:"C",   key:"Weak",                 color:"rgba(170,180,200,.55)"},
    {id:"rating_1", label:"D" ,  key:"Barely Present",       color:"rgba(170,180,200,.55)"},
];

// -------------------- Style Groups --------------------

export const COSMETIC_GROUPS = [
  {
    group: "Head",
    slots: [
      { id: "hair",         label: "Hair",                  key:"hair",         icon: "H" },
      { id: "hair_acc",     label: "Hair Accessories",      key:"hair_acc",     icon: "✿" },
      { id: "headwear",     label: "Headwear",              key:"headwear",     icon: "⌂" },
      { id: "earrings_L",   label: "Earrings (L)",          key:"earrings",     icon: "◍" },
      { id: "earrings_R",   label: "Earrings (R)",          key:"earrings",     icon: "◍" },
      { id: "face_deco",    label: "Face Decorations",      key:"face_deco",    icon: "✦" },
      { id: "neckwear",     label: "Neckwear",              key:"neckwear",     icon: "∿" },
      { id: "choker",       label: "Chokers",               key:"choker",       icon: "⟡" },
    ]
  },
  {
    group: "Clothing",
    slots: [
      { id: "dress",        label: "Dresses",               key:"dress",        icon: "D" },
      { id: "outerwear",    label: "Outerwear",             key:"outerwear",    icon: "O" },
      { id: "top",          label: "Tops",                  key:"top",          icon: "T" },
      { id: "u_under",      label: "Upper Underwear",       key:"u_under",      icon: "U" },
      { id: "bottom",       label: "Bottoms",               key:"bottom",       icon: "B" },
      { id: "l_under",      label: "Lower Underwear",       key:"l_under",      icon: "L" },
      { id: "socks",        label: "Socks",                 key:"socks",        icon: "S" },
      { id: "shoes",        label: "Shoes",                 key:"shoes",        icon: "⇣" },
    ]
  },
  {
    group: "Accessories",
    slots: [
      { id: "chest_acc",    label: "Chest Accessories",     key:"chest_acc",    icon: "✜" },
      { id: "pendant",      label: "Pendant",               key:"pendant",      icon: "⟠" },
      { id: "backpiece",    label: "Backpieces",            key:"backpiece",    icon: "⧉" },
      { id: "arm_deco_L",   label: "Arm Decorations (L)",   key:"arm_deco",     icon: "⟲" },
      { id: "arm_deco_R",   label: "Arm Decorations (R)",   key:"arm_deco",     icon: "⟳" },
      { id: "handheld_L",   label: "Handhelds (L)",         key:"handheld",     icon: "⟐" },
      { id: "handheld_R",   label: "Handhelds (R)",         key:"handheld",     icon: "⟐" },
    ]
  },
  {
    group: "Hands",
    slots: [
      { id: "bracelet_L",   label: "Bracelets (L)",         key:"bracelet",     icon: "⌁" },
      { id: "bracelet_R",   label: "Bracelets (R)",         key:"bracelet",     icon: "⌁" },
      { id: "glove_L",      label: "Gloves (L)",            key:"glove",        icon: "G" },
      { id: "glove_R",      label: "Gloves (R)",            key:"glove",        icon: "G" },
      { id: "ring_L1",      label: "Ring (L1)",             key:"rings",        icon: "◌" },
      { id: "ring_L2",      label: "Ring (L2)",             key:"rings",        icon: "◌" },
      { id: "ring_L3",      label: "Ring (L3)",             key:"rings",        icon: "◌" },
      { id: "ring_L4",      label: "Ring (L4)",             key:"rings",        icon: "◌" },
      { id: "ring_R1",      label: "Ring (R1)",             key:"rings",        icon: "◌" },
      { id: "ring_R2",      label: "Ring (R2)",             key:"rings",        icon: "◌" },
      { id: "ring_R3",      label: "Ring (R3)",             key:"rings",        icon: "◌" },
      { id: "ring_R4",      label: "Ring (R4)",             key:"rings",        icon: "◌" },
    ]
  }
];

export const ARMOR_GROUPS = [
  {
    group: "Head",
    slots: [
      { id:"helmet",        label:"Helmet",                 key:"helmet",       icon:"H", x:50, y:10, basePoints:22 },
      { id:"bevor",         label:"Bevor",                  key:"bevor",        icon:"N", x:50, y:22, basePoints:8  },
    ]
  },
  {
    group: "Arms",
    slots: [
      { id:"pauldron_L",    label:"Pauldron (L)",           key:"pauldron",     icon:"P", x:30, y:26, basePoints:7 },
      { id:"pauldron_R",    label:"Pauldron (R)",           key:"pauldron",     icon:"P", x:70, y:26, basePoints:7 },
      { id:"rerebrace_L",   label:"Rerebrace (L)",          key:"rerebrace",    icon:"R", x:27, y:33, basePoints:5 },
      { id:"rerebrace_R",   label:"Rerebrace (R)",          key:"rerebrace",    icon:"R", x:73, y:33, basePoints:5 },
      { id:"couter_L",      label:"Couter (L)",             key:"couter",       icon:"C", x:32, y:41, basePoints:4 },
      { id:"couter_R",      label:"Couter (R)",             key:"couter",       icon:"C", x:68, y:41, basePoints:4 },
      { id:"vambrace_L",    label:"Vambrace (L)",           key:"vambrace",     icon:"V", x:29, y:48, basePoints:4 },
      { id:"vambrace_R",    label:"Vambrace (R)",           key:"vambrace",     icon:"V", x:71, y:48, basePoints:4 },
      { id:"gauntlet_L",    label:"Gauntlet (L)",           key:"gauntlet",     icon:"G", x:28, y:55, basePoints:3 },
      { id:"gauntlet_R",    label:"Gauntlet (R)",           key:"gauntlet",     icon:"G", x:72, y:55, basePoints:3 },
    ]
  },
  {
    group: "Torso",
    slots: [
      { id:"spall",         label:"Back / Spall",           key:"spall",        icon:"B", x:50, y:28, basePoints:6  },
      { id:"cuirass",       label:"Cuirass",                key:"cuirass",      icon:"C", x:50, y:35, basePoints:36 },
      { id:"plackart",      label:"Plackart",               key:"plackart",     icon:"P", x:50, y:45, basePoints:24 },
      { id:"faulds",        label:"Faulds",                 key:"faulds",       icon:"F", x:50, y:55, basePoints:14 },
      { id:"rondels_L",     label:"Rondels (L)",            key:"rondels",      icon:"O", x:37, y:33, basePoints:1  },
      { id:"rondels_R",     label:"Rondels (R)",            key:"rondels",      icon:"O", x:64, y:33, basePoints:1  },
    ]
  },
  {
    group: "Legs",
    slots: [
      { id:"cuisses_L",     label:"Cuisses (L)",            key:"cuisses",      icon:"Q", x:46, y:64, basePoints:8 },
      { id:"cuisses_R",     label:"Cuisses (R)",            key:"cuisses",      icon:"Q", x:54, y:64, basePoints:8 },
      { id:"poleyn_L",      label:"Poleyn (L)",             key:"poleyn",       icon:"K", x:46, y:71, basePoints:5 },
      { id:"poleyn_R",      label:"Poleyn (R)",             key:"poleyn",       icon:"K", x:54, y:71, basePoints:5 },
      { id:"greaves_L",     label:"Greaves (L)",            key:"greaves",      icon:"S", x:46, y:78, basePoints:6 },
      { id:"greaves_R",     label:"Greaves (R)",            key:"greaves",      icon:"S", x:54, y:78, basePoints:6 },
      { id:"sabaton_L",     label:"Sabaton (L)",            key:"sabaton",      icon:"T", x:46, y:85, basePoints:2 },
      { id:"sabaton_R",     label:"Sabaton (R)",            key:"sabaton",      icon:"T", x:54, y:85, basePoints:2 },
    ]
  }
];

export const VARIANTS_BY_KEY = {
  // cosmetics
  hair:      [  "short","long","bob","pixie","undercut","braided","ponytail","twin_tails",
                "bun","messy","curly","wavy","straight","shaved","asymmetrical","ornate"],
  hair_acc:  [  "ribbons","clips","pins","flowers","beads","chains",
                "charms","horns", "cyber_nodes","feathers","crowns","tiaras"],
  headwear:  [  "hat","cap","hood","circlet","veil",
                "bandana","cowl","visor","mask_partial","crown"],
  earrings:  [  "stud","hoop",
                "dangling","chain","none"],
  face_deco: [  "tattoos","face_paint","scars","markings","makeup_light",
                "makeup_heavy","cyber_implants","runes","freckles","war_paint"],
  neckwear:  [  "scarf","mantle","neck_guard","wrap",
                "band","collar_high", "collar","veil"],
  choker:    [  "leather","metal","fabric","lace",
                "chain","collar","ritual_band", "gem"],
  dress:     [  "casual","formal","evening","battle_dress","ceremonial","summer","winter",
                "asymmetrical","layered","ornate","sundress","cocktail","gown","tech_dress"],
  outerwear: [  "coat","jacket","cloak","cape","poncho",
                "parka","mantle","trench","hooded","capelet"],
  top:       [  "shirt","blouse","tunic","crop_top",
                "corset","bodice","sweater","tank","techwear_top"],
  u_under:   [  "simple","lace","sport","silk",
                "thermal","ritual","bandage_wrap","compression"],
  bottom:    [  "pleated","techwear","flowing","ceremonial",
                "skirt","shorts","pants","leggings","cargo"],
  l_under:   [  "simple","lace","sport","silk",
                "thermal","ritual","bandage_wrap","compression"],
  socks:     [  "ankle","crew","knee_high",
                "thigh_high","patterned","compression","thermal"],
  shoes:     [  "boots","heels","flats",
                "sandals","sneakers","ritual"],
  chest_acc: [  "sash","strap","insignia","chain_drape",
                "core_mount","harness","brooch","badge"],
  pendant:   [  "amulet","medallion","device","core",
                "gemstone","coin","sigil","relic"],
  backpiece: [  "backpack","satchel","capelet","jetpack","banner",
                "relic_frame","small_pack","cape","wings","rig"],
  arm_deco:  [  "tattoos","cyber_augments","ritual_marks","chains",
                "bands","tattoo","charm","wraps"],
  handheld:  [  "tablet","orb","tool","relic",
                "lantern","book","device","flower"],

  bracelet:  [  "simple","chain","charm","beaded","sigil",
                "data_band","bangle","strap","beads","cuff"],
  glove:     [  "fingerless","cloth","ceremonial",
                "tech_gloves","leather","tactical","silk"],
  rings:     [  "simple","engraved","ritual","data_ring",
                "ornate","signet","gem_ring","stacked"],

  // armor
  helmet:    ["tactical_visor","open_face","full_helm","hooded_helm"],
  bevor:     ["plate","mail","leather_guard","none"],
  pauldron:  ["small","spiked","layered","none"],
  rerebrace: ["wrap","reinforced","servo","none"],
  couter:    ["cap","hinged","spiked","none"],
  vambrace:  ["wrap","reinforced","segmented","none"],
  gauntlet:  ["light","heavy","clawed","none"],

  spall:     ["plate_back","spine_guard","mail_back","none"],
  cuirass:   ["plate","brigandine","tactical_rig","robe_armor"],
  plackart:  ["segmented","solid_plate","ribbed","none"],
  faulds:    ["tassets","lamellar","layered","none"],
  rondels:   ["round","spiked","ornate","none"],

  cuisses:   ["plate","padded","lamellar","none"],
  poleyn:    ["cap","winged","spiked","none"],
  greaves:   ["plate","split","reinforced","none"],
  sabaton:   ["toed","layered","spiked","none"],
};

export const STYLE_GROUPS = [
  {
    id: "elegant",
    label: "Elegant",
    accent: "#B8A6FF",                 // lilac-violet (slightly calmer than before)
    labelColor: null,                   // auto-derived below
    labels: [
      "Elegant","Formal","Regal","Noble","Ceremonial","Minimal",
      "Tailored","Polished","Silkbound","Ornate","Refined","Gilded"
    ]
  },
  {
    id: "fresh",
    label: "Fresh",
    accent: "#6FFFC0",                 // mint-aqua
    labelColor: null,
    labels: [
      "Fresh","Organic","Floral","Pastoral","Lightweight","Handcrafted",
      "Breezy","Sunlit","Linen","Garden","Dewdrop","Spring"
    ]
  },
  {
    id: "sweet",
    label: "Sweet",
    accent: "#FF79C9",                 // candy pink
    labelColor: null,
    labels: [
      "Sweet","Cute","Playful","Whimsical","Charming","Soft",
      "Pastel","Ribboned","Dollish","Blushing","Sparkly","Delicate"
    ]
  },
  {
    id: "sexy",
    label: "Sexy",
    accent: "#FF3B63",                 // rose-red
    labelColor: null,
    labels: [
      "Sexy","Sensual","Provocative","Sultry","Alluring","Daring",
      "Laced","Sleek","Bodyline","Velvet","Tempting","Nocturne"
    ]
  },
  {
    id: "cool",
    label: "Cool",
    accent: "#49D2FF",                 // icy cyan
    labelColor: null,
    labels: [
      "Cool","Modern","Cyber","Techwear","Synthetic","Augmented",
      "Minimal","Chrome","Neonlined","Utility","Modular","Operator"
    ]
  },
  {
    id: "wild",
    label: "Wild",
    accent: "#FFBE4A",                 // amber-gold
    labelColor: null,
    labels: [
      "Wild","Rugged","Savage","Brutal","Battleworn","Ritualistic",
      "Occult","Spiked","Ferrous","Predator","Dustborn","Untamed"
    ]
  },
];

// -------------------- Shared data --------------------

export const WEAR_PROFILES = [
  { name:"Pristine",     min: 96, max:100 },
  { name:"Factory New",  min: 85, max: 95 },
  { name:"Used",         min: 60, max: 84 },
  { name:"Worn",         min: 35, max: 59 },
  { name:"Bare Metal",   min: 15, max: 34 },
  { name:"Broken",       min:  0, max: 14 },
];