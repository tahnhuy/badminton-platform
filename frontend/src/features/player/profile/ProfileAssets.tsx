type AssetName = 'home' | 'chevron' | 'trophy' | 'upload' | 'skill' | 'lock' | 'identity' | 'user' | 'shield' | 'save';
/** SVGs retain the intrinsic width/height exported from Figma. */
export function ProfileAsset({ name }: { name: AssetName }) {
  return <img className="profile-asset" src={`/images/profile/${name}.svg`} alt="" aria-hidden="true" />;
}
