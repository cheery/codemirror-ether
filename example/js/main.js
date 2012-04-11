// shim layer with setTimeout fallback
var requestAnimationFrame = (function(){
  return  window.requestAnimationFrame       || 
          window.webkitRequestAnimationFrame || 
          window.mozRequestAnimationFrame    || 
          window.oRequestAnimationFrame      || 
          window.msRequestAnimationFrame     || 
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

$(function(){
    var element = $('#example0')[0];
    var editor = EtherMirror(element, {
        lineNumbers: true,
        value: "If you type here, the corresponding\nchangeset appears on the right."
    });
    
    var show_changes = function(){
        $('#example0_out').text(editor.getChanges());
        requestAnimationFrame(show_changes);
    }
    requestAnimationFrame(show_changes);
});
