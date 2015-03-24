/**
 * A layer that will display indoor data
 *
 * addData takes a GeoJSON feature collection, each feature must have a level
 * property that indicates the level.
 *
 * getLevels can be called to get the array of levels that are present.
 */
L.Indoor = L.Layer.extend({

    options: {
        getFeatureLevel: function (feature) {
            return feature.properties.level;
        },
        getFeatureGroup: function (feature) {
            var fGroup = feature.properties.group;
            if (feature.properties.relations[0].reltags.group) { //Если у родительского relation установлен тэг group считаем его приоритетней
                fGroup = feature.properties.relations[0].reltags.group;
            }
            return fGroup;
        }
    },

    initialize: function(data, options) {
        L.setOptions(this, options);
        options = this.options;

        var layers = this._layers = {};

        this._map = null;

        this._levelName = {};

        this._feateresGroup = {
            highlightablePOI:{}
        };

        if ("level" in this.options) {
            this._level = this.options.level;
        } else {
            this._level = null;
        }

        if ("onEachFeature" in this.options)
            var onEachFeature = this.options.onEachFeature;

        this.options.onEachFeature = function(feature, layer) {
            if (onEachFeature)
                onEachFeature(feature, layer);

            if ("markerForFeature" in options) {
                var marker = options.markerForFeature(feature);
                if (typeof(marker) !== 'undefined') {
                    marker.on('click', function(e) {
                        layer.fire('click', e);
                    });

                    layers[feature.properties.level].addLayer(marker);
                }
            }
        };

        this.addData(data);
    },
    addTo: function(map) {
        map.addLayer(this);
        return this;
    },
    onAdd: function(map) {
        this._map = map;

        if (this._level === null) {
            var levels = this.getLevels();

            if (levels.length !== 0) {
                this._level = levels[0];
            }
        }

        if (this._level !== null) {
            if (this._level in this._layers) {
                this._map.addLayer(this._layers[this._level]);
            }
        }
    },
    onRemove: function(map) {
        if (this._level in this._layers) {
            this._map.removeLayer(this._layers[this._level]);
        }

        this._map = null;
    },
    addData: function(data, opt) {
        var layers = this._layers;
        var appendedLayers = [];

        var CTX = this;

        var options =  opt || this.options;

        options.getFeatureLevel = this.options.getFeatureLevel;
        this.getFeatureLevel = options.getFeatureLevel;
        options.getFeatureGroup = this.options.getFeatureGroup;

        var features = L.Util.isArray(data) ? data : data.features;

        features.forEach(function(part) {

            var levelInfo = options.getFeatureLevel(part);
            var level = levelInfo.value;

            var layer;

            if (typeof level === 'undefined' ||  level === null)
                return;

            if (!("geometry" in part)) {
                return;
            }
            CTX._levelName[level] =  levelInfo.name;

            if (L.Util.isArray(level)) {
                level.forEach(function(level) {
                    if (level in layers) {
                        layer = layers[level];
                    } else {
                        layer = layers[level] = L.geoJson({
                            type: "FeatureCollection",
                            features: []
                        }, options);
                    }
                    layer.addLayer(l);
                    appendedLayers.push(l);
                });
            } else {
                if (level in layers) {
                    layer = layers[level];
                } else {
                    layer = layers[level] = L.geoJson({
                        type: "FeatureCollection",
                        features: []
                    }, options);
                }

                var l = L.geoJson(part,options);
                if (part.properties.tags.backgroundImage) {
                    var bg = L.imageOverlay(part.properties.tags.backgroundImage, l.getBounds());
                    layer.addLayer(bg);
                }
                layer.addLayer(l);
                appendedLayers.push(l);
            }

            var highlightMark = part.properties.tags[options.higlightablePOITag];

            if (options.higlightablePOITag && highlightMark && part.properties.tags.zone_id) {
                CTX._feateresGroup.highlightablePOI[part.properties.tags.zone_id] = {};
                CTX._feateresGroup.highlightablePOI[part.properties.tags.zone_id].layer = l;
                CTX._feateresGroup.highlightablePOI[part.properties.tags.zone_id].defaultstyle = CTX.getStyleFromFeature(part);
            }
        });
        return appendedLayers;
    },
    getLevelBounds: function (level) {
        if (!level) {
            return this._layers[this._level].getBounds();
        }
        return this._layers[level].getBounds();
    },

    fitToBounds: function () {
        var bounds = this.getLevelBounds(this._level).pad(0.2);
        this._map.setMaxBounds(bounds);
        this._map.fitBounds(bounds, {animate: false, pan:{animate: false},zoom:{animate: false}});
    },
    getLevels: function() {
        return Object.keys(this._layers);
    },
    getLevelsNames: function (){
        return this._levelName;
    },
    getLevel: function() {
        return this._level;
    },
    getStyleFromFeature: function (feature) { //Функция построения объекта стиля по тэгам

        var fstyle = {
            weight: 1,
            color: '#666666',
            opacity: 1,
            fillColor: '#EEEEEE',
            fillOpacity: 0.7
        };

        if (feature.properties.tags.PDF_lineColor || feature.properties.tags.lineColor) {
            fstyle.color = feature.properties.tags.PDF_lineColor || feature.properties.tags.lineColor;
        }

        if (feature.properties.tags.lineOpacity) {
            fstyle.opacity = feature.properties.tags.lineOpacity;
        }

        if (feature.properties.tags.lineWeight) {
            fstyle.weight = feature.properties.tags.lineWeight;
        }

        if (feature.properties.tags.PDF_fillColor || feature.properties.tags.fillColor) {
            fstyle.fillColor = feature.properties.tags.PDF_fillColor || feature.properties.tags.fillColor;
        }

        if (feature.properties.tags.fillOpacity) {
            fstyle.fillOpacity = feature.properties.tags.fillOpacity;
        }

        if (feature.properties.tags.dash) {
            fstyle.dashArray = feature.properties.tags.dash;
        }

        return fstyle;
    },
    setLevel: function(level) {
        if (typeof(level) === 'object') {
            level = level.newLevel;
            var oldLevel = level.oldLevel;
        }
        if (this._level === level)
            return;
        var oldLayer = this._layers[oldLevel || this._level];
        var layer = this._layers[level];

        //var bounds = (this._layers[level])? this._layers[level].getBounds(): null;

        if (this._map !== null) {
            if (this._map.hasLayer(oldLayer)) {
                this._map.removeLayer(oldLayer);
            }

            if (layer) {
                this._map.addLayer(layer);
                //В этом месте иногда, очень очень редко, происходит краш движка. Замечено на Chrome 36.0.1985.143 m под MS Win 7 x64
                //this._map.setMaxBounds(bounds);
            }
        }

        this._level = level;
    },
    addLayer: function (layer, level) {
        if (typeof(layer) !== 'object') {
            return;
        }
        var destLevel = (level !== null) ? level : this._level;
        this._layers[destLevel].addLayer(layer);
    },
    removeLayer: function (layer, level) {
        if (typeof(layer) !== 'object') {
            return;
        }
        var destLevel = (level !== null) ? level : this._level;
        this._layers[destLevel].removeLayer(layer);
    },
    addMarker: function(marker) {
        if (typeof(marker) !== 'object')
            return;

        var level = (typeof marker.getLevel === 'function')? marker.getLevel() : null;

        if (level === undefined || level === null)
            level = this._level;

        var destLevel = this._layers[level];

        if (this._map !== null) {
            if (destLevel) {
                destLevel.addLayer(marker);
            }
        }
    },
    moveMarker: function(marker) {
        if (typeof(marker) !== 'object')
            return;

        var newlevel = (typeof marker.getLevel === 'function')? marker.getLevel() : null;

        if (this._layers[newlevel] === undefined || this._layers[newlevel] === null)
            return;

        if (this._level === newlevel && this._layers[newlevel].hasLayer(marker)) {

            this._layers[newlevel].removeLayer(marker);

            this._layers[newlevel].addLayer(marker);

        } else {
            for (level in this._layers) {
                if (this._layers[level].hasLayer(marker)) {

                    this._layers[level].removeLayer(marker);
                    marker.setZIndexOffset(1000);
                    this._layers[newlevel].addLayer(marker);

                }
            }
        }
    },
    removeMarker: function(marker, l) {
        if (typeof(marker) !== 'object')
            return;

        var level = (typeof marker.getLevel === 'function')? marker.getLevel() : l;

        if (level === undefined || level === null)
            level = this._level;

        var destLevel = this._layers[level];

        if (this._map !== null) {
            if (destLevel && destLevel.hasLayer(marker)) {
                destLevel.removeLayer(marker);
            }
        }
    }
});

L.indoor = function(data, options) {
    return new L.Indoor(data, options);
};

L.Control.Level = L.Control.extend({
    includes: L.Mixin.Events,

    options: {
        position: 'topright',
        parseLevel: function(level) {
            return parseInt(level, 10);
        }
    },

    initialize: function(options) {
        L.setOptions(this, options);

        this._map = null;
        this._buttons = {};
        this._listeners = [];
        this._level = options.level;

        this.addEventListener("levelchange", this._levelChange, this);
    },
    onAdd: function(map) {
        var div = L.DomUtil.create('div', 'ibecom-control');

        div.style.font = "18px 'Lucida Console',Monaco,monospace";
        var buttons = this._buttons;
        var activeLevel = this._level;
        var self = this;

        var levels = [];

        for (var i = 0; i < this.options.levels.length; i++) {
            var level = this.options.levels[i];

            var levelNum = self.options.parseLevel(level);

            levels.push({
                num: levelNum,
                label: this.options.labels[level] || level
            });
        }

        levels.sort(function(a, b) {
            return b.num - a.num;
        });

        var levelDiv = L.DomUtil.create('div', 'ibecom-control-levels');
        var iconDiv =  L.DomUtil.create('div', 'ibecom-control-icon');
        iconDiv.innerHTML ='<img src="levelctl.svg">';

        iconDiv.ondblclick = iconDiv.onclick = function(e){
            $(levelDiv).toggle();
            e.preventDefault();
            e.stopPropagation();
        };

        for (i = levels.length - 1; i >= 0; i--) {
            var level = levels[i].num;
            var originalLevel = levels[i].label;

            var btnClass =  'ibecom-level-button-container-passive';
            if (level == activeLevel) {
                btnClass = 'ibecom-level-button-container-active';
            }

            var levelBtn = L.DomUtil.create('div', btnClass, levelDiv);

            levelBtn.innerHTML = "<a class=\"ibecom-level-button-text noselect\">"+originalLevel+"</a>";

            (function(level) {
                levelBtn.onclick = function(e) {
                    self.setLevel(level);
                    if (typeof JSInterface !== 'undefined') {
                        try {
                            JSInterface.setFloor(level);
                        } catch (e) {
                            console.log(e);
                        }
                    } else {
                        console.log(level);
                    }
                };
            })(level);

            buttons[level] = levelBtn;
        }

        div.appendChild(levelDiv);
        div.appendChild(iconDiv);
        return div;
    },
    _levelChange: function(e) {
        if (this._map !== null) {
            if (typeof e.oldLevel !== "undefined")
                $(this._buttons[e.oldLevel]).removeClass("ibecom-level-button-container-active").addClass("ibecom-level-button-container-passive");
            $(this._buttons[e.newLevel]).removeClass("ibecom-level-button-container-passive").addClass("ibecom-level-button-container-active");
        }
    },
    setLevel: function(level) {

        if (level === this._level)
            return;

        var oldLevel = this._level;
        this._level = level;

        this.fireEvent("levelchange", {
            oldLevel: oldLevel,
            newLevel: level
        });
    },
    getLevel: function() {
        return this._level;
    }
});

L.Control.level = function(options) {
    return new L.Control.Level(options);
};
