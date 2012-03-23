(function() {
  var ether;

  ether = $.ether;

  $(function() {
    var editor1, editor2, syncronise1, syncronise2;
    editor1 = new ether.Editor(document.body, {
      value: "hello"
    });
    editor2 = new ether.Editor(document.body, {
      value: "wunderbar"
    });
    editor1.head("squirrel farted over your tree");
    editor2.head("squirrel farted over your tree");
    syncronise1 = function() {
      var a1;
      a1 = editor1.pick();
      if (!editor2.sync(a1)) return console.log("editor2.sync failed.");
    };
    syncronise2 = function() {
      var a2;
      a2 = editor2.pick();
      if (!editor1.sync(a2)) return console.log("editor1.sync failed.");
    };
    setInterval(syncronise1, 1000);
    return setInterval(syncronise2, 300);
  });

}).call(this);
