import 'i18next'

import type { Catalog } from './en'

// Type the `t` function against the English catalog so key typos are caught.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: Catalog }
  }
}
