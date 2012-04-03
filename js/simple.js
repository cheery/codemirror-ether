$(function(){
    $('button#create').click(function(){
        var socket = io.connect('/ether');
        socket.emit('new', {}, function(name){
            document.location = '/'+name;
        });
    });
    $('button#edit').click(function(){
        var pad_id = $(this).attr('pad_id');
        $('#content').open_ether(pad_id);
    });
});
