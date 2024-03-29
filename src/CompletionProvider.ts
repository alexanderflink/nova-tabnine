import TabNineService from './TabNineService'

class CompletionProvider {
  tabNineService: TabNineService
  constructor(tabNineService: TabNineService) {
    this.tabNineService = tabNineService
  }

  async provideCompletionItems(editor: TextEditor, context: CompletionContext) {
    // get document strings
    const cursorPosition = context.position
    const document = editor.document
    // TODO: truncate text if too long

    // text before cursor
    const before = document.getTextInRange(new Range(0, cursorPosition))

    // text after cursor
    const after = document.getTextInRange(
      new Range(cursorPosition, Math.max(cursorPosition, document.length - 1)),
    )

    // construct request
    if (document.path) {
      const request = {
        Autocomplete: {
          before,
          after,
          region_includes_beginning: true,
          region_includes_end: true,
          filename: document.path,
        },
      }

      const response = await this.tabNineService.request(request)

      // we got a response from TabNine, return it as CompletionItems
      const result = JSON.parse(response) as AutocompleteResponse
      if (result.results) {
        const completionItems = result.results
          .sort((a, b) => {
            // sort completions by detail
            if (a.detail && b.detail) {
              return (parseFloat(a.detail) || 0) - (parseFloat(b.detail) || 0)
            }
            return 0
          })
          .map((item) => {
            // get range from cursor to end of line
            const selectedRange = editor.selectedRange
            const lineRange = editor.document.getLineRangeForRange(selectedRange)
            const rangeAfterCursor = new Range(selectedRange.end, lineRange.end - 1) // don't include newline
            const textAfterCursor = editor.document.getTextInRange(rangeAfterCursor)

            // construct CompletionItem
            const completionItem = new CompletionItem(
              item.new_prefix + item.new_suffix,
              CompletionItemKind.Statement, // no fitting kind to use
            )
            // insert completion before cursor
            completionItem.insertText = item.new_prefix

            const additionalTextEdits = []

            // check if text after cursor exists in completion
            if (item.new_prefix.search(textAfterCursor) !== -1) {
              additionalTextEdits.push(TextEdit.delete(rangeAfterCursor))
            }

            // insert completion after cursor
            if (item.new_suffix) {
              additionalTextEdits.push(TextEdit.insert(context.position, item.new_suffix))
            }

            completionItem.additionalTextEdits = additionalTextEdits

            completionItem.documentation = result.user_message.join(' ')
            completionItem.detail = 'TabNine ' + (item.detail || '')

            return completionItem
          })
        return completionItems
      } else {
        throw new Error('no TabNine response')
      }
    }
    throw new Error('No document path')
  }
}

export default CompletionProvider
