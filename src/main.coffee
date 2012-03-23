class client_editor
  constructor: (element, options) ->
    options ?= {}
    options.onChange = (editor, changes) =>
      while changes
          start = @ghost.indexFromPos changes.from
          stop = @ghost.indexFromPos changes.to
          text = changes.text.join '\n'
          trail = @ghost.length - stop
          changeset = data: text, changes: [
              {mode:'.', count:start},
              {mode:'-', count:stop-start},
              {mode:'+', count:text.length},
              {mode:'.', count:trail},
          ]
          u = @unsent
          @unsent = catenate @unsent, changeset
          #console.log "CATENATE(#{pack u},#{pack changeset}) = #{pack @unsent}"
          @ghost.splice changes.from, changes.to, text
          changes = changes.next
    @ghost = new GhostFile (options.value or "")
    @editor = CodeMirror element, options
    @unsent = null
    #@unsent = data: "", changes: [mode:'.', count:@ghost.length]

  splice: (start, stop, text) ->

  playback: (changeset) ->
    unsent = @unsent
    translate_to_splices changeset, (start, count, text) =>
        from = @ghost.posFromIndex(start)
        to = @ghost.posFromIndex(start+count)
        @editor.replaceRange text, from, to
    @unsent = unsent


  retrieve: () ->
    res = @unsent
    @unsent = null
    #@unsent = data: "", changes: [mode:'.', count:@ghost.length]
    return res

  reset: (head) ->
    @editor.setValue head
    @unsent = null

$ ->
    ether = $.ether
