var cluster = require('cluster');
if (cluster.isMaster) {
    var numCPUs = require('os').cpus().length;
    console.log('Master cluster setting up ' + numCPUs + ' workers');

    for (var i = 0; i <= numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('online', function(worker) {
        console.log('Worker ' + worker.process.pid + ' is online')
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('Workers ' + worker.process.pid + ' died with ' + code + ' and signal ' + signal);
        console.log('Starting new Worker');
        cluster.fork();
    })

} else {
    var http = require('http');
    http.globalAgent.maxSockets = 25;
    const request = require('request-promise');
    const cheerio = require('cheerio');
    const bodyParser = require("body-parser");
    const async = require('async');
    const formidable = require('formidable');
    const fs = require('fs-extra');
    const XLSX = require('xlsx');
    const json2xls = require('json2xls');
    const express = require('express');
    const fakeUa = require('fake-useragent');
    const EventEmitter = require('events');
    class MyEmitter extends EventEmitter {}
    const myEmitter = new MyEmitter();


    var headers = {
        'User-Agent': fakeUa()
    };

    process.setMaxListeners(Infinity);

    var app = express();

    app.use(express.static('public'))
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(json2xls.middleware);


    var stat = [];
    sellerLinks_stat = [];
    var pp;

    app.post('/send-file', function(request, response, next) {
        var form = new formidable.IncomingForm();
        var fileName = '';

        fs.stat(__dirname + '/public/' + 'data.xlsx', function(err, stats) {
            if (err) {
                return console.error(err);
            }
            fs.unlink(__dirname + '/public/' + 'data.xlsx', function(err) {
                if (err) return console.log(err);
                console.log('file deleted successfully');
            });
        });


        form.parse(request, function(err, fields, files) {
            var oldpath = files.userfile.path;
            fileName = files.userfile.name;

            // change you path over here
            var newpath = __dirname + '/' + files.userfile.name;
            fs.rename(oldpath, newpath, function(err) {
                if (err) console.log(err);
                response.write('File uploaded and moved!');
                response.end();
            });
        });

        form.on('error', function(err) {
            console.log(err)
        });

        form.on('aborted', function() {
            console.log('request aborted')
        });


        form.on('end', function(fields, files) {

            var workbook = XLSX.readFile(fileName);
            var sheet_name_list = workbook.SheetNames;
            sheet_name_list.forEach(function(y) {
                var worksheet = workbook.Sheets[y];
                var headers = {};
                var data = [];
                for (z in worksheet) {
                    if (z[0] === '!') continue;
                    var tt = 0;
                    for (var i = 0; i < z.length; i++) {
                        if (!isNaN(z[i])) {
                            tt = i;
                            break;
                        }
                    };
                    var col = z.substring(0, tt);
                    var row = parseInt(z.substring(tt));
                    var value = worksheet[z].v;

                    //Store Header Names
                    if (row == 1 && value) {
                        headers[col] = value;
                        continue;
                    }

                    if (!data[row]) data[row] = {};
                    data[row][headers[col]] = value;
                }
                data.shift();
                data.shift();

                var iterations = 0;



                async.whilst(
                    function() {
                        return iterations < data.length;
                    },
                    function(callback) {
                        console.log(iterations)
                        var data1 = {}
                        getSellerInfo(data[iterations].UPC)
                            .then(async(data) => {
                                data1.listOfLinks = await data.listOfLinks.filter(function(element) {
                                    return element !== undefined;
                                });
                                console.log(data.pd_upc)
                                data1.pd_upc = data.pd_upc;
                                if (data1.listOfLinks.length > 0) {
                                    getSellerDetails(data1)
                                        .then(data => {
                                            iterations += 1;
                                            callback();
                                        })
                                        .catch(err => {
                                            console.log(err);
                                            iterations += 1;
                                            callback();
                                        })
                                } else {
                                    iterations += 1;
                                    callback();
                                }
                            })
                            .catch(function(err) {
                                console.log(err)
                                iterations += 1;
                            })
                    },
                    function(err) {
                        if (!err) {
                            console.log('done1');
                            var xls = json2xls(sellerLinks_stat);
                            fs.writeFileSync(__dirname + '/public/' + 'data.xlsx', xls, 'binary');
                        } else {
                            console.log(err)
                            console.log('OOps.. something went wrong somewhere');
                        }
                    }
                );

            });

        });

    })


    var getSellerInfo = function(UPC) {
        return new Promise((resolve, reject) => {
            console.log('getSellerInfo get called')
            var word = UPC;
            var returnObj = {};
            var url = 'https://www.ebay.com/sch/i.html?_nkw=' + word + '&_in_kw=1&_ex_kw=&_sacat=0&_udlo=&_udhi=&_ftrt=901&_ftrv=1&_sabdlo=&_sabdhi=&_samilow=&_samihi=&_sargn=-1%26saslc%3D1&_fsradio2=%26LH_LocatedIn%3D1&_salic=1&LH_SubLocation=1&_sop=12&_dmd=1&_ipg=50&_fosrp=1';

            try {
                request.get({
                    url: url,
                    headers: headers
                }, async(err, resp, html) => {
                    if (err) {
                        console.log(err);
                    }
                    const $ = await cheerio.load(html);

                    let listOfLinks = $('ul > li').map((i, el) => {
                        const $lnk = $(el).find('h3 > a')
                        return $lnk.attr('href');
                    }).get();
                    returnObj.listOfLinks = listOfLinks;
                    returnObj.pd_upc = word;
                    if (listOfLinks) {
                        resolve(returnObj)
                    }
                })
            } catch (e) {
                console.log(e)
                reject(e)
            }

        })
    }


    var getSellerDetails = function(sellerLinks) {
        console.log('getSellerDetails called')
        var sellerLnk = sellerLinks.listOfLinks;

        return new Promise((resolve, reject) => {
            Promise.all(sellerLnk.map((link, index) => {
                var obj = {};

                try {
                    request.get({
                        url: link,
                        headers: headers
                    }, async(err, resp, html) => {
                        if (err) {
                            console.log(err)
                        }
                        const $ = await cheerio.load(html);
                        let sellerLocation = $('#itemLocation > div.u-flL.iti-w75 > div > div.iti-eu-bld-gry > span').text();
                        obj.sellerLocation = sellerLocation ? sellerLocation : 'not avail'
                        obj.UPC = sellerLinks.pd_upc;
                        let sellerName = $('#mbgLink > span').text();
                        obj.sellerName = sellerName ? sellerName : 'not avail'
                        let feedPercent = $('#RightSummaryPanel > div.si-cnt.si-cnt-eu.vi-grBr.vi-padn0.c-std > div > div > div > div.bdg-90 > div.mbg.vi-VR-margBtm3 > span > a').text();
                        obj.feedPercent = feedPercent ? feedPercent : 'not avail'
                        let sellerRating = $('#si-fb').text();
                        obj.sellerRating = sellerRating ? sellerRating : 'not avail'
                        obj.sellerLocation = obj.sellerLocation.replace(/(\r\n|\n|\r)/gm, "");
                        obj.sellerLocation = obj.sellerLocation.replace('\t', '');
                        console.log(obj)

                        let avail_us = await obj.sellerLocation.includes("United States");

                        if (avail_us) {
                            await sellerLinks_stat.push(obj)
                        }

                        myEmitter.emit('getSellerDetailsEvent', sellerLinks_stat);

                    })
                } catch (e) {
                    console.log(e)
                    obj.UPC = sellerLinks.pd_upc;
                    obj.sellerLocation = 'not found';
                    obj.sellerName = 'not found';
                    obj.feedPercent = 'not found';
                    obj.sellerRating = 'not found';
                    sellerLinks_stat.push(obj)
                }
            })).then(function(values) {
                myEmitter.on('getSellerDetailsEvent', function(Links_stat) {
                    console.log('===++++++++===')
                    console.log(Links_stat)
                    console.log('===++++++++===')
                    resolve(Links_stat)
                });
            });
        })
    }


    app.listen(3000, function() {
        console.log('Server listening on port 3000!');
    });
}