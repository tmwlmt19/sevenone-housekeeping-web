import { Globe, Settings2, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Language, Theme } from '@/lib/api/types'
import { usePreferences } from '@/lib/preferences/preferences'

/** Header control to switch theme (light/dark/system) and language (en/es). */
export function PreferencesMenu() {
  const { t } = useTranslation()
  const { theme, language, setTheme, setLanguage } = usePreferences()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('prefs.preferences')}>
          <Settings2 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sun className="size-3.5" />
          {t('prefs.theme')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as Theme)}
        >
          <DropdownMenuRadioItem value="light">
            {t('prefs.light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            {t('prefs.dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            {t('prefs.system')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="size-3.5" />
          {t('prefs.language')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(v) => setLanguage(v as Language)}
        >
          <DropdownMenuRadioItem value="en">
            {t('prefs.english')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="es">
            {t('prefs.spanish')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
