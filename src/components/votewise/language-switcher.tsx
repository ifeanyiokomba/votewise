'use client'

import { Globe, Check, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/lib/store'
import { LANGUAGES, getLanguageMeta, type Language } from '@/lib/i18n'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Compact language switcher — fits in the navbar next to the theme toggle.
// Shows the current language's flag + name. Clicking opens a dropdown with
// all 5 supported languages (English, French, Yoruba, Hausa, Igbo).
// On selection: persists to localStorage (via the store), shows a toast,
// and re-renders all useTranslation consumers automatically.
//
// Note: the store's `language` defaults to 'en' on both server and client
// (see store.ts hydrate()), so the initial render is hydration-safe. After
// the client mounts, hydrate() loads the saved language from localStorage
// and the component re-renders with the user's preference.
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const language = useApp((s) => s.language)
  const setLanguage = useApp((s) => s.setLanguage)
  const current = getLanguageMeta(language)

  function handleSelect(lang: Language) {
    if (lang === language) return
    const meta = getLanguageMeta(lang)
    setLanguage(lang)
    // Toast in the language the user just switched TO — feels more natural.
    const messages: Record<Language, string> = {
      en: `Language changed to ${meta.englishName}`,
      fr: `Langue changée en ${meta.englishName}`,
      yo: `Èdè ti yípadà sí ${meta.englishName}`,
      ha: `An canza yare zuwa ${meta.englishName}`,
      ig: `Gbanwee asụsụ gaa na ${meta.englishName}`,
    }
    toast.success(messages[lang])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-9 gap-1.5 px-2.5 text-sm font-medium',
            compact && 'h-9 w-9 px-0',
          )}
          aria-label="Switch language"
        >
          {compact ? (
            <Languages className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <>
              <Globe className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">{current.flag}</span>
              <span className="hidden md:inline">{current.name}</span>
              <span className="sm:hidden">{current.flag}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Languages className="h-3.5 w-3.5" /> Language / Èdè / Yare / Asụsụ
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => handleSelect(l.code)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-2 py-2',
              l.code === language && 'bg-primary/5',
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base leading-none">{l.flag}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight">{l.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {l.englishName}
                </span>
              </div>
            </div>
            {l.code === language && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
