# Third-Party Notices

ProjectBase is distributed under the [MIT License](LICENSE). Files in `app/pb_public/vendor/` include third-party browser software under the licenses below. Those licenses apply to the respective components, not to ProjectBase as a whole.

This inventory is based on the vendored filenames and license/version banners present in this repository. When a minified file does not include a complete license text, consult the linked upstream release before redistributing a modified vendor bundle.

| Vendored file | Upstream project | Version visible in the vendored file | License indicated by the distribution/upstream |
|---|---|---:|---|
| `confetti.min.js` | [canvas-confetti](https://github.com/catdad/canvas-confetti) | 1.9.3 | ISC |
| `lucide.js` | [Lucide](https://github.com/lucide-icons/lucide) | 1.33.0 | ISC |
| `marked.min.js` | [Marked](https://github.com/markedjs/marked) | not stated in the banner | MIT |
| `pocketbase.umd.js` | [PocketBase JavaScript SDK](https://github.com/pocketbase/js-sdk) | not stated in the banner | MIT |
| `purify.min.js` | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.1.6 | Apache-2.0 OR MPL-2.0 |
| `sortable.min.js` | [SortableJS](https://github.com/SortableJS/Sortable) | 1.15.2 | MIT |
| `vue.global.prod.js` | [Vue.js](https://github.com/vuejs/core) | not stated in the banner | MIT |

The `icon-192.png` and `icon-512.png` files in the same directory are ProjectBase application assets, not identified in the repository as third-party packages.

ProjectBase's Docker and native installation paths download the [PocketBase](https://github.com/pocketbase/pocketbase) server binary, pinned by the current scripts to version 0.39.11. PocketBase is distributed by its upstream project under the MIT license and is not authored by ProjectBase.

Copyright notices embedded in vendored distributions must be preserved. In particular, `marked.min.js` identifies copyright © 2011–2025 Christopher Jeffrey and contributors, and DOMPurify identifies Cure53 and other contributors. Upstream repositories contain the authoritative license texts and attribution histories.

If this inventory is incomplete or inaccurate, please open a documentation issue or pull request with the affected file, upstream source, version, and license evidence.
