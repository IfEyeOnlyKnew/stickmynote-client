import { Node, mergeAttributes } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    details: {
      setDetails: () => ReturnType
    }
  }
}

// Details wrapper (collapsible container)
export const Details = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary detailsContent",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute("open"),
        renderHTML: (attributes) => (attributes.open ? { open: "" } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "details" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setDetails:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [
              {
                type: "detailsSummary",
                content: [{ type: "text", text: "Toggle section" }],
              },
              {
                type: "detailsContent",
                content: [{ type: "paragraph" }],
              },
            ],
          })
        },
    }
  },
})

// Summary line (clickable toggle header)
export const DetailsSummary = Node.create({
  name: "detailsSummary",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0]
  },
})

// Content inside the collapsible block
export const DetailsContent = Node.create({
  name: "detailsContent",
  group: "block",
  content: "block+",
  defining: true,

  parseHTML() {
    return [{ tag: "div[data-details-content]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-details-content": "" }),
      0,
    ]
  },
})
