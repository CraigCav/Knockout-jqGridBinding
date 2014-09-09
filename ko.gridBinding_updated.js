(function ($) {
    ko.bindingHandlers.grid = {
        init: function ( element, valueAccessor ) {
            //field name to be used as unique id
            ko.bindingHandlers.grid.rowIdName = "jqGridRowId";
            var value = valueAccessor();
            $(element).tabletogrid(value);
            subscribeToGridEvents(element, value);
            return {// prohibit to process internal bindings
                controlsDescendantBindings: true
            };
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var $element = $(element);
            var value = valueAccessor();
            var griddata = value.data();
            //ini unique Id
            $.each(griddata, function (ind, el) {
                return el[ko.bindingHandlers.grid.rowIdName] = ind;
            } );
            //if collection was modified
            if(element.originalArr && element.originalArr === griddata) {
                var compRes = ko.utils.compareArrays(element.originalData, griddata);
                $.each(compRes, function (i, r) {
                    switch(r.status) {
                        case "added": {
                            $element.jqGrid("addRowData", r.value[ko.bindingHandlers.grid.rowIdName], ko.toJS(r.value));
                            break;

                        }
                        case "deleted": {
                            $element.jqGrid("delRowData", r.value[ko.bindingHandlers.grid.rowIdName]);
                            break;

                        }
                    }
                });
                //save array to be able to retrieve original object instances
                element.originalData = griddata.slice(0);
                $element.trigger('reloadGrid');
                return;
            }
            //save base binding context to be able to build child context for records
            element.bindingContext = bindingContext;
            element.originalData = griddata.slice( 0 );
            //save reference to original array to be able to check if bindeded array changed or just updated
            element.originalArr = griddata;
            //Do not use ko.toJS it's very slow because it subscribes each reader 
            var res = prepareObservables(element, griddata, $element.getGridParam().colModel);
            $element.clearGridData().setGridParam({
                data: res
            }).trigger('reloadGrid');
            clearSelectedItems(value);
        }
    };
    function prepareObservables(table, data, colModels) {
        var res = [];
        for(var i = 0; i < data.length; i++) {
            var obj = {
            };
            var el = data[i];
            for(var j = 0; j < colModels.length; j++) {
                var m = colModels[j];
                var val = el[m.index];
                if(typeof val === 'undefined') {
                    continue;
                }
                if ( typeof val === 'function' && typeof val['peek'] != 'undefined' ) {
                    //subscribe on vm updates to update internal grid's collection (to allow filter to work) 
                    val.subscribe((function () {
                        var rowInd = el[ko.bindingHandlers.grid.rowIdName];
                        return function (val) {
                            return syncObj(table, rowInd);
                        }
                    } )() );
                    //retreive latest value of observable
                    val = val.peek();
                }
                obj[m.index] = val;
            }
            obj[ko.bindingHandlers.grid.rowIdName] = el[ko.bindingHandlers.grid.rowIdName];
            res.push(obj);
        }
        return res;
    }
    function syncObj(table, rowId) {
        var si = ko.utils.arrayFirst(table.originalData, function (item) {
            return item[ko.bindingHandlers.grid.rowIdName] == rowId;
        });
        $(table).jqGrid("setRowData", rowId, ko.toJS(si));
        $(table).find("tr[id=" + rowId + "]").each(function (i) {
            var gbd = table.bindingContext;
            var cbc = gbd.createChildContext(si);
            ko.applyBindings(cbc, this);
        });
    }
    function clearSelectedItems(value) {
        if(value.selectedItems) {
            value.selectedItems([]);
        }
    }
    function subscribeToGridEvents(element, value) {
        var idParamName = $(element).getRowId();
        $(element).jqGrid('setGridParam', {
            onSelectRow: function (id, selected) {
                var selectedItem = ko.utils.arrayFirst(value.data(), function (item) {
                    return item[idParamName] == id;
                });
                if(value.selectedItem && selected) {
                    value.selectedItem(selectedItem);
                }
                if(value.onSelectRow && selected) {
                    value.onSelectRow(id);
                }
                if(value.selectedItems) {
                    selected ? value.selectedItems.push(selectedItem) : value.selectedItems.remove(selectedItem);
                }
            },
            onSelectAll: function (ids, selected) {
                if(selected) {
                    value.selectedItems(ko.utils.arrayFilter(value.data(), function (item) {
                        return $.inArray(item[idParamName], ids) != -1;
                    }));
                } else {
                    value.selectedItems.removeAll();
                }
            },
            gridComplete: function () {
                //set binding context to records 
                var curData = element.originalData;
                $(element).find("tr").each(function () {
                    var rowId = this.id;
                    if($.isNumeric(rowId) == false) {
                        return;
                    }
                    var row = ko.utils.arrayFirst(curData, function (r) {
                        return r[idParamName] == rowId;
                    });
                    var gbd = element.bindingContext;
                    var cbc = gbd.createChildContext(row);
                    ko.applyBindings(cbc, this);
                });
            }
        });
    }
    $.fn.getRowId = function () {
        return $(this).getGridParam('localReader').id;
    };
    $.fn.tabletogrid = function (settings) {
        settings = settings || {
        };
        $(this).each(function () {
            if(this.grid) {
                return;
            }
            var element = $( this ).width( settings.width || '99%' ), 
                options = {
                            datatype: 'local',
                            colModel: [],
                            colNames: [],
                            height: settings.height || 'auto',
                            altRows: true            }, pagerOptions = settings.pager || {
                            target: '#pager',
                            rowNum: 10,
                            rowList: [10, 20, 50]
                          }, 
                idParamName = ko.bindingHandlers.grid.rowIdName;
            pagerOptions.pager = $(pagerOptions.target).length == 0 ? null : pagerOptions.target;
            $.extend(options, settings, pagerOptions, {
                width: element.width(),
                caption: $('caption', element).text(),
                localReader: {
                    id: idParamName
                },
                ignoreCase: true
            });
            buildColModel(element, options);
            element.empty().jqGrid(options);
            $(element).jqGrid().filterToolbar({
                stringResult: true,
                searchOnEnter: false,
                defaultSearch: 'cn'
            });
        });
    };
    function buildColModel(element, options) {
        var templates = $('td', element);
        $('th', element).each(function () {
            var source = $(this);
            var col = source.attr('id') || source.data().field || $.trim($.jgrid.stripHtml(source.html())).split(' ').join('_');
            var model = {
                name: col,
                index: col,
                width: source.width()
            };
            var template = templates.filter('[data-field="' + model.index + '"]');
            $.extend(model, source.data());
            if(template.length > 0) {
                model['template'] = template;
                model['formatter'] = knockoutTemplate;
            } else {
                //set default template
                model['editable'] = true;
                model['formatter'] = defaultKnockoutFormatter;
            }
            options.colModel.push(model);
            options.colNames.push(source.html());
        });
    }
    function knockoutTemplate(cellval, opts, rwd) {
        if(opts.colModel[0]) {
            var element = $(opts.colModel[0]).clone();
            return element.html();
        }
        return cellval;
    }
    function defaultKnockoutFormatter(cellval, opts, rwd) {
        return '<input type="text" data-bind="value: ' + opts.colModel.index + '"' + 'style="width: 98%;" role="textbox" class="editable"' + '/>';
    }
})(jQuery);
