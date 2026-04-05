// Simple fallback for class-variance-authority in v0 sandbox environment
type ClassValue = string | number | boolean | undefined | null
type ClassArray = ClassValue[]
type ClassDictionary = Record<string, any>
type ClassProp = ClassValue | ClassArray | ClassDictionary

function resolveClassProp(input: ClassProp): string {
  if (!input) return ""
  if (typeof input === "string") return input
  if (Array.isArray(input)) return cn(...input)
  if (typeof input === "object") {
    return Object.keys(input).filter((key) => input[key]).join(" ")
  }
  return ""
}

export function cn(...inputs: ClassProp[]): string {
  return inputs.map(resolveClassProp).filter(Boolean).join(" ")
}

type VariantConfig = {
  variants?: Record<string, Record<string, string>>
  defaultVariants?: Record<string, string>
}

export function cva(base: string, config?: VariantConfig) {
  return (props?: Record<string, string | undefined> & { className?: string }) => {
    const parts = [base]

    if (config?.variants && props) {
      parts.push(...resolveVariants(config.variants, props))
    }

    if (config?.defaultVariants) {
      parts.push(...resolveDefaultVariants(config.variants, config.defaultVariants, props))
    }

    if (props?.className) {
      parts.push(props.className)
    }

    return parts.filter(Boolean).join(" ")
  }
}

function resolveVariants(
  variants: Record<string, Record<string, string>>,
  props: Record<string, string | undefined>,
): string[] {
  const classes: string[] = []
  for (const [key, value] of Object.entries(props)) {
    if (key === "className") continue
    const variantClass = value ? variants[key]?.[value] : undefined
    if (variantClass) classes.push(variantClass)
  }
  return classes
}

function resolveDefaultVariants(
  variants: Record<string, Record<string, string>> | undefined,
  defaultVariants: Record<string, string>,
  props?: Record<string, string | undefined>,
): string[] {
  const classes: string[] = []
  for (const [key, defaultValue] of Object.entries(defaultVariants)) {
    if (props?.[key] !== undefined) continue
    const variantClass = variants?.[key]?.[defaultValue]
    if (variantClass) classes.push(variantClass)
  }
  return classes
}

export type VariantProps<T extends (...args: any) => any> = {
  [K in keyof Parameters<T>[0]]?: Parameters<T>[0][K]
}
