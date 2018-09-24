$(document).on('click', '#close-preview', function(){ 
    $('.image-preview').popover('hide');
    // Hover befor close the preview
    $('.image-preview').hover(
        function () {
           $('.image-preview').popover('show');
        }, 
         function () {
           $('.image-preview').popover('hide');
        }
    );    
});


var myVar;


    // Create the close button
    var closebtn = $('<button/>', {
        type:"button",
        text: 'x',
        id: 'close-preview',
        style: 'font-size: initial;',
    });
    closebtn.attr("class","close pull-right");
    // Set the popover default content
    $('.image-preview').popover({
        trigger:'manual',
        html:true,
        title: "<strong>Preview</strong>"+$(closebtn)[0].outerHTML,
        content: "There's no image",
        placement:'bottom'
    });
    // Clear event
    $('.image-preview-clear').click(function(){
        $('.image-preview').attr("data-content","").popover('hide');
        $('.image-preview-filename').val("");
        $('.image-preview-clear').hide();
        $('.image-preview-input input:file').val("");
        $(".image-preview-input-title").text("Browse"); 
    }); 
    // Create the preview image
    $(".image-preview-input input:file").change(function (){     
        var img = $('<img/>', {
            id: 'dynamic',
            width:250,
            height:200
        });      
        var file = this.files[0];
        var reader = new FileReader();
        // Set preview image into the popover data-content
        reader.onload = function (e) {
            $(".image-preview-input-title").text("Change");
            $(".image-preview-clear").show();
            $(".image-preview-filename").val(file.name);            
            img.attr('src', e.target.result);
            $(".image-preview").attr("data-content",$(img)[0].outerHTML).popover("show");
        }        
        reader.readAsDataURL(file);
        console.log(file)

          
        var formData = new FormData();
        formData.append( 'userfile', file);

        $.ajax({
          type: 'POST',
          url: '/send-file',
          contentType: false,
          processData: false,
          data: formData,
          success: function(data){ 
            console.log('success') 
            myVar = setInterval(myTimer, 7000);
          },
          error: function(error){
            console.log('error')
          }
        })
    });


    $('#dwnld').hide();

        function myTimer() {
            console.log('hi')
            $.get('/data.xlsx')
            .done(function() {
              console.log('success')
              myStopFunction();
              $('#dwnld').show();
              $('#dwnld').attr("href", '/data.xlsx');
               $('.image-preview').popover('hide');  
            }).fail(function() { 
               console.log('err') 
            })
        }

        function myStopFunction() {
            clearInterval(myVar);
        }
   