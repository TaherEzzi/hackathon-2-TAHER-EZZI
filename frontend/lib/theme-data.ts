import type { ThemePresetRow, UserCategory } from "@/lib/types";

/**
 * Offline catalog of all 90 theme presets (6 categories × 15), seeding order
 * matches the live DB: JW=1–15, HB=16–30, BV=31–45, WA=46–60, WT=61–75, TS=76–90.
 *
 * The Theme Studio always tries a live read of `theme_preset` first (authed,
 * RLS-protected). This catalog is the fallback so the atelier never opens bare —
 * and it carries the real card copy from THEME_PRESETS.md.
 * `preview_path` is null everywhere until the Gemini previews are uploaded and
 * linked; when present, the studio renders the image instead of gradient art.
 */

type PresetSeed = [id: number, name: string, description: string];

const JW: PresetSeed[] = [
  [1, "Velvet Vault", "Diamond pendant on burgundy velvet, single hard spotlight, glinting bokeh dust."],
  [2, "Golden Hour Showcase", "Rose-gold ring on warm sand at golden hour, honey backlight, film grain."],
  [3, "Marble & Silk", "Pearl strand on silk over veined marble, diffused daylight, editorial calm."],
  [4, "Botanical Bloom", "Silver leaf earrings on eucalyptus, dew droplets, moss-green freshness."],
  [5, "Mirror Reflection", "Gold chain on black mirror, perfect reflection, cool rim light."],
  [6, "Dark Slate Macro", "Emerald in platinum on slate, focus-stacked macro, moody beam of light."],
  [7, "Floating Gemfield", "Amethyst pendant levitating among micro-crystals on purple-to-black."],
  [8, "Heritage Regal", "Vintage brooch on aged leather, tungsten candlelight, dark academia baroque."],
  [9, "Champagne Silk Studio", "Champagne-gold bangle on rippled silk, match-toned quiet-luxury catalog."],
  [10, "Zen Stone", "Gold stud on a river pebble beside raked sand, zen garden stillness."],
  [11, "Neon Aurora", "Iridescent ring under cyan–magenta neon, glossy cyber-luxury energy."],
  [12, "Vintage Archive", "Locket pinned to aged vellum, museum flat light, still-life study."],
  [13, "Water Lens", "Sapphire pendant submerged, refracted caustics, underwater turquoise glow."],
  [14, "Starlight Blue", "Tennis bracelet on navy velvet, cold key light, celestial bokeh."],
  [15, "Geometric Bauhaus", "Gold ring on bold color-block shapes, graphic flat-lay energy."],
];

const HB: PresetSeed[] = [
  [16, "Editorial Pastel", "Mint-leather bag on lilac seamless, crisp shadow, clean catalog aesthetic."],
  [17, "Luxe Sofa Scene", "Quilted bag on a velvet sofa arm, tungsten hotel lounge, shallow focus."],
  [18, "Minimal Concrete", "Tote on a concrete plinth in a white gallery, one shaft of skylight."],
  [19, "City Street Flash", "Red shoulder bag on dusk sidewalk, hard flash, 35mm streetwear campaign."],
  [20, "Floating Hero Gradient", "Satchel levitating on a navy-to-orange gradient, dust motes in the beam."],
  [21, "Autumn Leather", "Cognac crossbody on a park bench, golden side light, tactile close-up."],
  [22, "Serious Black Studio", "Matte clutch under a single hard beam, dark moody lux art direction."],
  [23, "Runway Flash", "Satin bag on a spotlight runway pedestal, hazy theatrical beam."],
  [24, "Flat Lay Grid", "Overhead flat lay with scarf and croissant on terracotta tile."],
  [25, "Atelier Craft", "Bag mid-assembly on a scarred workbench, awl and waxed thread, warm window light."],
  [26, "Travel Postcard", "Carryall perched on a vintage suitcase, linen bench, evocative depth."],
  [27, "Pastel Pop Studio", "Baby-blue mini bag on an orange–blue split background, pop-art shadows."],
  [28, "Steel & Glass", "Graphite bag before a skyscraper reflection, cool executive morning."],
  [29, "Art Gallery Wall", "Sculptural bag on an in-wall shelf, museum spotlight installation."],
  [30, "Suede Monochrome", "Tan suede against tonal tan, wrap-around light, texture-rich calm."],
];

const BV: PresetSeed[] = [
  [31, "Frozen Splash", "Bottle inside a frozen splash arc, backlit rim, razor-sharp droplets."],
  [32, "Citrus Burst", "Soda can and orange slices frozen midair, vibrant summer freeze-frame."],
  [33, "Ice & Mint", "Cold-brew can in crushed ice with mint, condensation beads, cyan key."],
  [34, "Neon Bar", "Cocktail silhouette against neon signage bokeh, wet counter nighttime."],
  [35, "Rustic Craft", "Kraft coffee pouch with roasted beans, warm roastery window light."],
  [36, "Summit Dream", "Chilled can on a misty boulder at dawn, epic outdoors haze."],
  [37, "Vapor Cool", "Frost-covered bottle in dry-ice fog, icy blue gradient chill."],
  [38, "Clean Classic", "White-label bottle on pale seamless, one soft shadow, premium minimal."],
  [39, "Tropical Sunset", "Fruity bottle against banana leaves, orange-and-teal golden backlight."],
  [40, "Levitation Can", "Slim can suspended mid-turn, condensation ring below, dramatic underglow."],
  [41, "Golden Hour Glass", "Fresh juice backlit to glowing honey, droplets sliding down the glass."],
  [42, "Soft Diffuse", "Pastel can on linen, big soft top light, airy low-contrast minimal."],
  [43, "High-Speed Micro", "Macro bubbles rising through amber liquid, shallow sparkling depth."],
  [44, "Studio Gym", "Protein shaker beside grip chalk on rubber flooring, athletic hard light."],
  [45, "Fruit Flat Lay", "Juice bottle on kitchen marble with lime, mint, and zest curls."],
];

const WA: PresetSeed[] = [
  [46, "Old Money Office", "Bifold wallet on a cherry desk with fountain pen, brass-lamp glow."],
  [47, "Craft Threads", "Half-stitched saddle wallet on a bench with awls and waxed thread."],
  [48, "Raw Leather Cut", "Off-cuts on untreated hide, shadowless museum lighting, documentary."],
  [49, "Chevron Geometry", "Slim wallet on a zigzag backdrop, hard geometric raking shadows."],
  [50, "Executive Slate", "Black cardholder on wet slate, cool fresnel top light, quiet power."],
  [51, "Travel Flat Lay", "Passport wallet with boarding stubs and coins on linen, wanderlust."],
  [52, "Gift Box Reveal", "Wallet nested in opened tissue, ribbon curl, warm unboxing light."],
  [53, "Textile Contrast", "Leather against tweed and denim swatches, tactile fabric collision."],
  [54, "Monochrome Studio", "All-gray set, a single ripple of light on gray leather, minimal."],
  [55, "Stitch Macro", "Extreme close-up of a saddle-stitched edge, thread razor-sharp."],
  [56, "Desert Tan", "Tan wallet on terracotta tiles with cactus shadow, desert warmth."],
  [57, "Dark Academia", "Wallet with ink blotter, wax-sealed letter, banker-lamp scholarship."],
  [58, "Gentle Gradient", "Slim wallet on a pink-to-blue dividing line, soft dual-tone wash."],
  [59, "Coin Still Life", "Wallet splayed with spilled coins on oak, honest window light."],
  [60, "Neon Night Market", "Wallet on a metallic bar under purple neon, wet urban reflections."],
];

const WT: PresetSeed[] = [
  [61, "Slate Macro Hero", "Chronograph on dark slate, one beam across the dial, macro precision."],
  [62, "Museum Pedestal", "Watch on a white plinth, flat gallery light, art-object presentation."],
  [63, "Underwater Bubbles", "Diver watch suspended amid bubble streams, cyan light shafts."],
  [64, "Blueprint Cabinet", "Field watch beside dimension diagrams, drafting paper, engineering spirit."],
  [65, "Summit Ice", "Steel sports watch on glacial ice, crisp high-altitude expedition light."],
  [66, "Stone Raw", "Rose-gold dress watch on granite, earthy stone against polished metal."],
  [67, "Ribbon Levitation", "Watch mid-air with the strap curving in an S, staged levitation ad."],
  [68, "Neon Night", "Blacked-out watch under magenta–cyan neon, wet streetwear energy."],
  [69, "Aviator Cockpit", "Pilot chronograph on a worn cockpit panel, warm instrument glow."],
  [70, "Time-Pass Blur", "Watch dead-center while the dial numbers streak past in motion blur."],
  [71, "Vintage Archive", "1960s dress watch on a felt-lined tray, tungsten restoration story."],
  [72, "Coral Vibrant", "Bright dial on tropical coral paper props, punchy summer catalog."],
  [73, "Japanese Minimal", "Two-hand watch on pale wood with chiyogami paper, muji calm."],
  [74, "Train Window", "Commuter watch at a misty train window, landscape streaking past."],
  [75, "Academic Column", "Dress watch beside fluted marble fragments, classical statuary poise."],
];

const TS: PresetSeed[] = [
  [76, "Studio Hang", "Heavyweight tee on a velvet hanger, clean gradient, crisp weave."],
  [77, "90s Flat Lay", "Folded tee with earbuds and cassette on worn denim, direct flash nostalgia."],
  [78, "Skate Flash", "Tee worn at a dusk street curb, hard flash, 35mm documentary grain."],
  [79, "Minimal Logo Single", "Chest-print tee on a mannequin torso, seamless pale gallery wall."],
  [80, "Athletic Motion", "Performance tee mid-sprint through water spray, dark storm studio."],
  [81, "Tie-Dye Eco", "Hand-dyed tee crumpled on a bedsheet with dye vials, loft window light."],
  [82, "Anime Poster", "Graphic tee on a wall of manga stickers, neon poster vibrancy."],
  [83, "Grunge Tape", "Faded band tee taped to concrete, harsh street flash, subculture."],
  [84, "Hanger Row", "Five tees in tonal shades on a black rail, boutique shelf discipline."],
  [85, "Editorial Drape", "Oversized tee over a chair in a sun-streaked minimalist loft."],
  [86, "Levitation Fold", "Folded tee suspended mid-rotation, soft gradient, gravity-free ad."],
  [87, "Runway Crop", "Cropped tee at the runway edge, warm spotlight haze, backstage drama."],
  [88, "Eco Packaging", "Folded tee in a compostable mailer on dried grass, natural light."],
  [89, "Sports Flat Grid", "Active tee flat-laid with stopwatch and gym chalk, hard grid daylight."],
  [90, "Monochrome Craft", "Washed-black tee on raw draped linen, tonal tailoring, micro-texture."],
];

const SECTIONS: Array<[UserCategory, PresetSeed[]]> = [
  ["jewelry", JW],
  ["handbags", HB],
  ["beverages", BV],
  ["wallets", WA],
  ["watches", WT],
  ["tshirts", TS],
];

export const CATEGORIES: Array<{
  value: UserCategory;
  label: string;
  glyph: string;
  blurb: string;
}> = [
  { value: "jewelry", label: "Jewelry", glyph: "💎", blurb: "Metal, stone, glint" },
  { value: "handbags", label: "Handbags", glyph: "👜", blurb: "Leather, line, posture" },
  { value: "beverages", label: "Beverages", glyph: "🥤", blurb: "Droplet, fizz, chill" },
  { value: "wallets", label: "Wallets", glyph: "👛", blurb: "Stitch, grain, origin" },
  { value: "watches", label: "Watches", glyph: "⌚", blurb: "Dial, beam, precision" },
  { value: "tshirts", label: "T-shirts", glyph: "👕", blurb: "Drape, print, culture" },
];

export const FALLBACK_PRESETS: ThemePresetRow[] = SECTIONS.flatMap(
  ([category, seeds]) =>
    seeds.map(([id, name, description]) => ({
      id,
      category,
      name: `${name}`,
      description,
      preview_path: null as string | null,
    })),
);

export const CATEGORY_LABEL: Record<UserCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<UserCategory, string>;
