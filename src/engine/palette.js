import { Color } from 'three';

// User-approved sRGB swatches. Keep hue separate from HDR light intensity.
export const PALETTE = Object.freeze({
  gokuOrange: '#F47A20',
  deepGiOrange: '#D95E11',
  sunsetOrangeHighlight: '#FF9B42',
  gokuBlue: '#1F5FBF',
  deepRoyalBlue: '#163E8C',
  undershirtBlueHighlight: '#3A7BE0',
  superSaiyanGold: '#F7D64A',
  brightAuraYellow: '#FFE45C',
  goldenHighlight: '#FFF2A6',
  energyWhite: '#FFFDF7',
  auraGlowCream: '#FFF3C9',
  lightSkinBase: '#F2C29B',
  warmSkinShadow: '#D89A73',
  tanSkinBase: '#C98B65',
  deepSkinShadow: '#8B5C44',
  animeBlack: '#111111',
  softBlack: '#1E1E24',
  hairHighlightBlueBlack: '#2A3140',
  vegetaBlue: '#2146B7',
  armorWhite: '#F4F4F1',
  armorGold: '#D6A43A',
  armorShadowGray: '#9A9EA8',
  friezaWhite: '#F7F5F3',
  friezaPurple: '#8E57C8',
  deepFriezaPurple: '#5B2F91',
  villainVioletGlow: '#B37CFF',
  piccoloGreen: '#6BAF45',
  deepNamekGreen: '#3E7A2E',
  namekLime: '#A7D84C',
  piccoloPurple: '#6A2E8C',
  kamehamehaCyan: '#67DDF7',
  kamehamehaBlue: '#33A8F2',
  deepBeamBlue: '#1267D6',
  energyTeal: '#43E4D0',
  spiritGlowWhite: '#F6FFFF',
  scouterGreen: '#6CFF5B',
  radarGreen: '#8EFF78',
  alertRed: '#E83A34',
  techGray: '#707784',
  dbzSkyBlue: '#5DA9F6',
  deepSkyBlue: '#2E73D8',
  cloudWhite: '#F8FBFF',
  namekSkyTeal: '#63D9C8',
  namekWaterCyan: '#3DC7C4',
  grassGreen: '#4DA63F',
  rockBrown: '#8A6448',
  explosionYellow: '#FFD447',
  explosionOrange: '#FF8C22',
  explosionRed: '#E6472F',
  smokeGray: '#7A7A80',
  debrisBrown: '#6E4A34',
});

export const paletteColor=(name,intensity=1)=>new Color(PALETTE[name]).multiplyScalar(intensity);
// Shader calculations are linear; convert the approved sRGB values exactly once.
export const shaderPalette=Object.keys(PALETTE).map(name=>`const vec3 p_${name}=vec3(${paletteColor(name).toArray().map(v=>v.toFixed(8)).join(',')});`).join('\n')+'\n';
export function installPaletteVariables(root){
  for(const [name,hex] of Object.entries(PALETTE))root.style.setProperty('--palette-'+name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),hex);
}
