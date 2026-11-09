import { ImageIcon } from 'lucide-react'

/** Reserved for catalog media uploads when the API supports them. */
export function NewModelMediaPlaceholder() {
  return (
    <div className="new-model-media-placeholder" role="status">
      <div className="new-model-media-icon" aria-hidden="true">
        <ImageIcon size={22} />
      </div>
      <div className="new-model-media-copy">
        <p className="new-model-media-title">Lookbook &amp; product imagery</p>
        <p className="muted">
          Photo uploads and color-swatch textures are not wired to the catalog API yet. Create the model and variants
          below; imagery can be added once media endpoints are available.
        </p>
      </div>
    </div>
  )
}
