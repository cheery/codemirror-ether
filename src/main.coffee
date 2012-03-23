ether = $.ether

$ ->
    editor1 = new ether.Editor document.body,
        value: "hello"

    editor2 = new ether.Editor document.body,
        value: "wunderbar"

    editor1.head "squirrel farted over your tree"
    editor2.head "squirrel farted over your tree"

    syncronise1 = () ->
        a1 = editor1.pick()
        console.log "editor2.sync failed." unless editor2.sync(a1)

    syncronise2 = () ->
        a2 = editor2.pick()
        console.log "editor1.sync failed." unless editor1.sync(a2)

    setInterval syncronise1, 1000
    setInterval syncronise2, 300
