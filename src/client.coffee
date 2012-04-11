core = $.ether_core


class Editor
  constructor: (element, options) ->
    options ?= {}
    options.onChange = (editor, changes) =>
      while changes
          start = @ghost.indexFromPos changes.from
          stop = @ghost.indexFromPos changes.to
          text = changes.text.join '\n'
          length = @ghost.length
          changeset = core.splice_to_changeset start, stop, text, length
          @changeset = core.catenate @changeset, changeset
          @ghost.splice changes.from, changes.to, text
          changes = changes.next
    @ghost = new Ghost (options.value or "")
    @editor = CodeMirror element, options
    @changeset = '$'

  head: (head) ->
    @editor.setValue head
    @ghost.setValue head
    @changeset = '$'

  pick: () ->
    res = @changeset
    @changeset = '$'
    return res

  sync: (changeset) ->
    fresh = follow @changeset, changeset
    editor_changeset = follow changeset, @changeset
    return false if editor_changeset == undefined or fresh == undefined
    core.convert_to_splices fresh, (start, count, text) =>
        from = @ghost.posFromIndex(start)
        to = @ghost.posFromIndex(start+count)
        @editor.replaceRange text, from, to
    @changeset = editor_changeset
    return true

$.fn.open_ether = (pad_id) -> @each -> new_editor(@, pad_id)

# not everything matters here as there was history in the original easysync algorithm.
# implementation is assuming every message is getting through, in order.
new_editor = (element, pad_id) ->
  element.innerHTML = 'connecting to server'
  socket = io.connect '/ether'
  socket.on 'disconnect', () ->
    element.innerHTML = 'editor disconnected'
  socket.emit 'clone', {pad_id}, (response) ->
    if response.error?
        element.innerHTML = response.error
        return
    element.innerHTML = ''
    editor = new Editor element,
      value: response.head
      lineNumbers: true
    revision = response.revision
    waiting = []
    socket.on 'sync', (info) -> # 'walk' up the chain.
        revision++
        changeset = info.package
        for i in [0...waiting.length]
            waiting_changeset = waiting[i]
            waiting[i] = core.follow changeset, waiting_changeset
            changeset = core.follow waiting_changeset, changeset
        unless editor.sync changeset
            socket.emit 'error', 'sync failed!'

    socket.on 'ack', (count) ->
        waiting.splice(0, count) # could be bundled and added into history.
        revision++

    sync = ->
        changeset = editor.pick()
        if changeset? and changeset != '$'
            info = {
                revision: revision
                package: changeset
            }
            waiting.push changeset
            socket.emit 'data', info
        setTimeout sync, 2000
    setTimeout sync, 2000

#$ ->
#    sync_visual = (editor) ->
#      wait = editor.sent_changeset? or editor.changeset?
#      $('.sync_visual').toggleClass 'wait', wait
#
#    users = []
#
#    editor = new ether.Editor $('#contain')[0],
#        value: "editor is in offline mode",
#        on_input: (editor) ->
#          sync_visual(editor)
#    editor.revision = 0
#    editor.sent_changeset = null
#
#    socket = io.connect 'http://localhost:8090'
#    socket.on 'new', (info) ->
#      editor.head info.head
#      editor.revision = info.revision
#      editor.you = null
#      sync_visual(editor)
#      user_visual()
#    socket.on 'you', (uid) ->
#      editor.you = uid
#      user_visual()
#    socket.on 'disconnect', () ->
#      editor.head "editor is in offline mode"
#      users = []
#
#    socket.on 'update', (info) ->
#      editor.revision = info.revision
#      changeset = ether.unpack info.package
#      X = editor.sent_changeset
#      editor.sent_changeset = ether.follow changeset, X
#      unless editor.sync (ether.follow X, changeset)
#        console.log "local sync fail!"
#
#    user_visual = () ->
#      $('#users').empty()
#      for uid in users
#        console.log editor.you, uid
#        $('<li>').text('uid'+uid).appendTo('#users').toggleClass('you', editor.you==uid)
#
#    socket.on 'join', (uid) ->
#      users.push uid
#      user_visual()
#
#    socket.on 'part', (uid) ->
#      users.splice users.indexOf(uid), 1
#      user_visual()
#
#    sync = () ->
#       editor.sent_changeset = ether.catenate editor.sent_changeset, changeset
#       socket.emit 'changeset', info, (revision) ->
#         console.log "remote sync fail!" if revision == null # for now
#         editor.revision = revision
#         editor.sent_changeset = null
#         sync_visual(editor)
#    setInterval sync, 2000
