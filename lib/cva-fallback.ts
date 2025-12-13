// Simple fallback for class-variance-authority in v0 sandbox environment
type ClassValue = string | number | boolean | undefined | null
type ClassArray = ClassValue[]
type ClassDictionary = Record<string, any>
type ClassProp = ClassValue | ClassArray | ClassDictionary

export function cn(...inputs: ClassProp[]): string {
  const classes: string[] = []

  for (const input of inputs) {
    if (!input) continue

    if (typeof input === "string") {
      classes.push(input)
    } else if (Array.isArray(input)) {
      const result = cn(...input)
      if (result) classes.push(result)
    } else if (typeof input === "object") {
      for (const key in input) {
        if (input[key]) classes.push(key)
      }
    }
  }

  return classes.join(" ")
}

type VariantConfig = {
  variants?: Record<string, Record<string, string>>
  defaultVariants?: Record<string, string>
}

export function cva(base: string, config?: VariantConfig) {
  return (props?: Record<string, string | undefined> & { className?: string }) => {
    let result = base

    if (config?.variants && props) {
      for (const [variantKey, variantValue] of Object.entries(props)) {
        if (variantKey === "className") continue

        const variant = config.variants[variantKey]
        if (variant && variantValue && variant[variantValue]) {
          result += " " + variant[variantValue]
        }
      }
    }

    // Apply default variants if not specified
    if (config?.defaultVariants) {
      for (const [key, defaultValue] of Object.entries(config.defaultVariants)) {
        if (!props || props[key] === undefined) {
          const variant = config.variants?.[key]
          if (variant && variant[defaultValue]) {
            result += " " + variant[defaultValue]
          }
        }
      }
    }

    if (props?.className) {
      result += " " + props.className
    }

    return result
  }
}

export type VariantProps<T extends (...args: any) => any> = {
  [K in keyof Parameters<T>[0]]?: Parameters<T>[0][K]
}
