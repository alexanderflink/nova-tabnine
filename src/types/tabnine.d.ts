interface AutoCompleteRequest {
  Autocomplete: {
    before: string
    after: string
    region_includes_beginning: boolean
    region_includes_end: boolean
    filename: string | null
  }
}

enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

interface ResultEntry {
  new_prefix: string
  old_suffix: string
  new_suffix: string

  kind: CompletionItemKind | null
  detail: string | null
  documentation: string | null
  deprecated: bool | null
}

interface AutocompleteResponse {
  old_prefix: string
  results: ResultEntry[]
  user_message: string[]
}
