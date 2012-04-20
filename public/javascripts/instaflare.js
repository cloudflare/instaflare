CloudFlare.define("instaflare", ["cloudflare/deferred", "cloudflare/iterator", "cloudflare/dom", "cloudflare/console", "instaflare/config"], function(deferred, iterator, dom, console, _config) {
    var instaflare = {};
    instaflare.filterHelpers = {
        safe: function(i) {
            return Math.min(255, Math.max(0, i));
        },
        contrast: function(f, c) {
            return (f-0.5) * c + 0.5;
        },
        bias: function(f, bi){
            return f / ((1.0 / bi - 1.9) * (0.9 - f) + 1);
        }
    };

    instaflare.createFilter = function(imageData, getPixel) {
        function processPixel(data, i,j,width, options){
            var index = (i*width*4) + (j*4),
                        rgb = getPixel(
                            data[index],
                            data[index + 1],
                            data[index + 2],
                            data[index + 3],
                            options
                        );

                    data[index]     = rgb.r;
                    data[index + 1] = rgb.g;
                    data[index + 2] = rgb.b;
                    data[index + 3] = rgb.a;
        }

        return function(options) {
            var width = imageData.width,
                height = imageData.height,
                data = imageData.data,
                i,
                j;

            for(i = 0; i < height; i++)
                for(j = 0; j < width; j++)
                    processPixel(data, i, j,width, options);
        };
    }

    instaflare.createFilterableData = function(canvas) {
        function createFilter(getPixel){
            return function() {
                try { throw 'break'; } catch(e) {}
                instaflare.createFilter(imageData, getPixel)(arguments);
                return chainable;
            };
        }

        var context = canvas.getContext('2d'),
            width = canvas.width,
            height = canvas.height,
            imageData = context.getImageData(0, 0, width, height),
            chainable = {
                imageData: imageData,
                saturation: createFilter(function(r, g, b, a, args) {
                    var avg = ( r + g + b ) / 3,
                        t = args[0];

                    return {
                        r: instaflare.filterHelpers.safe(avg + t * (r - avg)),
                        g: instaflare.filterHelpers.safe(avg + t * (g - avg)),
                        b: instaflare.filterHelpers.safe(avg + t * (b - avg)),
                        a: a
                    };
                }),
                contrast: createFilter(function(r, g, b, a, args) {
                    var val = args[0];

                    return {
                        r: instaflare.filterHelpers.safe(255 * instaflare.filterHelpers.contrast(r / 255, val)),
                        g: instaflare.filterHelpers.safe(255 * instaflare.filterHelpers.contrast(g / 255, val)),
                        b: instaflare.filterHelpers.safe(255 * instaflare.filterHelpers.contrast(b / 255, val)),
                        a: a
                    };
                }),
                tint: createFilter(function(r, g, b, a, args) {
                    var maxRGB = args[1],
                        minRGB = args[0];
                    return {
                        r: instaflare.filterHelpers.safe((r - minRGB[0]) * ((255 / (maxRGB[0] - minRGB[0])))),
                        g: instaflare.filterHelpers.safe((g - minRGB[1]) * ((255 / (maxRGB[1] - minRGB[1])))),
                        b: instaflare.filterHelpers.safe((b - minRGB[2]) * ((255 / (maxRGB[2] - minRGB[2])))),
                        a: a
                    };
                }),
                posterize : createFilter(function(r,g,b,a,args) {
                    var step = Math.floor(255 / args[0]);
                    return {
                        r: instaflare.filterHelpers.safe(Math.floor(r / step) * step),
                        g: instaflare.filterHelpers.safe(Math.floor(g / step) * step),
                        b: instaflare.filterHelpers.safe(Math.floor(b / step) * step),
                        a: a
                    };
                }),
                grayscale : createFilter(function(r,g,b,a) {
                    var avg = (r + g + b) / 3;
                    return {
                        r: instaflare.filterHelpers.safe(avg),
                        g: instaflare.filterHelpers.safe(avg),
                        b: instaflare.filterHelpers.safe(avg),
                        a: a
                    };
                }),
                bias : createFilter(function(r,g,b,a,args) {
                    var val = args[0];
                        return {
                            r: instaflare.filterHelpers.safe(r * instaflare.filterHelpers.bias(r / 255, val)),
                            g: instaflare.filterHelpers.safe(g * instaflare.filterHelpers.bias(g / 255, val)),
                            b: instaflare.filterHelpers.safe(b * instaflare.filterHelpers.bias(b / 255, val)),
                            a: a
                        };
                }),
                brightness : createFilter(function(r,g,b,a,args) {
                    var val = args[0];
                    return {
                        r: instaflare.filterHelpers.safe(r + val),
                        g: instaflare.filterHelpers.safe(g + val),
                        b: instaflare.filterHelpers.safe(b + val),
                        a: a
                    };
                })
            }

        return chainable;
    }

    instaflare.canvasFromImage = function(image) {
        var canvas = document.createElement('canvas'),
            context = canvas.getContext('2d');

        canvas.width = image.width;
        canvas.height = image.height;

        context.drawImage(image, 0, 0);

        canvas.applyToImage = function() {
            image.src = canvas.toDataURL();
        };

        return canvas;
    };

    instaflare.filters = {
        drugstore: function(data) {
            return data
                .saturation(0.3)
                .posterize(70)
                .tint([50, 35, 10], [190, 190, 230]);
        },
        hangover: function(data) {
            return data
                .tint([60, 35, 10], [170, 170, 230])
                .saturation(0.8);
        },
        madison: function(data) {
            return data
                .grayscale()
                .tint([60,60,30], [210, 210, 210]);
        },
        bluerinse: function(data) {
            return data
                .tint([30, 40, 30], [120, 170, 210])
                .contrast(0.75)
                .bias(1)
                .saturation(0.6)
                .brightness(20);
        },
        jaundice: function(data) {
            return data
                .saturation(0.4)
                .contrast(0.75)
                .tint([20, 35, 10], [150, 160, 230]);
        }
    }

    instaflare.canvasIsSupported = (function() {
        var canvas = document.createElement('canvas');
        return !!(canvas.getContext && canvas.getContext('2d'));
    })(),

    instaflare.processImage = function(image, filter) {
        var canvas = instaflare.canvasFromImage(image);
        var data = instaflare.createFilterableData(canvas);
        data = instaflare.filters[filter](data);
        context = canvas.getContext('2d');
        context.putImageData(data.imageData, 0, 0);
        canvas.applyToImage();
    }

    instaflare.flare = function(filter){
        if(instaflare.canvasIsSupported) {

            var images = document.getElementsByTagName('img');
            var sliced = Array.prototype.slice.call(images);
            var queue = deferred.ref();

            iterator.forEach(sliced, function(image) {

                console.log('foo')
                var span = document.createElement("span"),
                    caption = document.createTextNode('Hipsterizing...');

                span.appendChild(caption);
                dom.setAttribute(span, "style", "font-family:'Helvetica Neue';font-weight:200;color:#fff;text-shadow:1px 1px 1px #000;position:absolute;left:" + (image.offsetLeft + 5) + "px;top:" + (image.offsetTop + 5) + "px;z-index:99999;");

                image.parentNode.insertBefore(span, image);

                queue = queue.then(function() {
                    instaflare.processImage(image, filter);
                    span.parentNode.removeChild(span);
                })
            });
        }
    }

    dom.onLoad.then(function() {
        instaflare.flare(_config.filter);
    });

    return instaflare;
});
