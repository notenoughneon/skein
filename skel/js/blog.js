$("time").each(function() {
    var month = ["Jan","Feb","Mar","Apr","May","Jun",
                 "Jul","Aug","Sep","Oct","Nov","Dec"];
    var dt = new Date($(this).attr("datetime"));
    var delta = $.now() - dt.getTime();
    if (delta < 1000*60*60) {
        $(this).text(Math.floor(Math.max(0,delta/(1000*60))) + "m");
    } else if (delta < 1000*60*60*24) {
        $(this).text(Math.floor(delta/(1000*60*60)) + "h");
    } else if (delta < 1000*60*60*24*30) {
        $(this).text(Math.floor(delta/(1000*60*60*24)) + "d");
    } else if (delta < 1000*60*60*24*365) {
        $(this).text(dt.getDate() + " " + month[dt.getMonth()]);
    } else {
        $(this).text(dt.getDate() + " " + month[dt.getMonth()]
            + " " + dt.getFullYear());
    }
    return true;
});
