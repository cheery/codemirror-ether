ether = $.ether

# not everything matters here as there was history in the original easysync algorithm.
$ ->
    sync_visual = (editor) ->
      wait = editor.sent_changeset? or editor.changeset?
      $('.sync_visual').toggleClass 'wait', wait

    users = []

    editor = new ether.Editor $('#contain')[0],
        value: "editor is in offline mode",
        on_input: (editor) ->
          sync_visual(editor)
    editor.revision = 0
    editor.sent_changeset = null

    socket = io.connect 'http://localhost:8090'
    socket.on 'new', (info) ->
      editor.head info.head
      editor.revision = info.revision
      editor.you = null
      sync_visual(editor)
      user_visual()
    socket.on 'you', (uid) ->
      editor.you = uid
      user_visual()
    socket.on 'disconnect', () ->
      editor.head "editor is in offline mode"
      users = []

    socket.on 'update', (info) ->
      editor.revision = info.revision
      changeset = ether.unpack info.package
      X = editor.sent_changeset
      editor.sent_changeset = ether.follow changeset, X
      unless editor.sync (ether.follow X, changeset)
        console.log "local sync fail!"

    user_visual = () ->
      $('#users').empty()
      for uid in users
        console.log editor.you, uid
        $('<li>').text('uid'+uid).appendTo('#users').toggleClass('you', editor.you==uid)

    socket.on 'join', (uid) ->
      users.push uid
      user_visual()

    socket.on 'part', (uid) ->
      users.splice users.indexOf(uid), 1
      user_visual()

    sync = () ->
       changeset = editor.pick()
       return unless changeset?
       console.log "emit #{ether.pack changeset}"
       info =
         revision: editor.revision
         package: ether.pack changeset
       editor.sent_changeset = ether.catenate editor.sent_changeset, changeset
       socket.emit 'changeset', info, (revision) ->
         console.log "remote sync fail!" if revision == null # for now
         editor.revision = revision
         editor.sent_changeset = null
         sync_visual(editor)
    setInterval sync, 2000
