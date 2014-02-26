//knockout binding
(function ($) {
    ko.bindingHandlers.grid = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var value = valueAccessor();
            $(element).tabletogrid(value, bindingContext);
            subscribeToSelectEvents(element, value);

            //tell knockout to ignore descendants of this element
            return { controlsDescendantBindings: true };
        },
        update: function (element, valueAccessor) {
            var value = valueAccessor();
            var griddata = value.data();
            $(element).clearGridData().setGridParam({ data: ko.toJS(griddata) }).trigger('reloadGrid');
            clearSelectedItems(value);
        }
    };

    function clearSelectedItems(value) {
        if (value.selectedItems) {
            value.selectedItems([]);
        };
    }

    function subscribeToSelectEvents(element, value) {
        var idParamName = $(element).getGridParam('localReader').id;
        $(element).jqGrid('setGridParam', {
            onSelectRow: function (id, selected) {
                var selectedItem = ko.utils.arrayFirst(value.data(), function (item) { return item[idParamName] == id; });

                if (value.selectedItem && selected) {
                    value.selectedItem(selectedItem);
                }
                if (value.onSelectRow && selected) {
                    value.onSelectRow(id);
                }
                if (value.selectedItems) {
                    selected ? value.selectedItems.push(selectedItem) : value.selectedItems.remove(selectedItem);
                }
            }
        });
        $(element).jqGrid('setGridParam', {
            onSelectAll: function (ids, selected) {
                if (selected) {
                    value.selectedItems(ko.utils.arrayFilter(value.data(), function (item) {
                        return $.inArray(item[idParamName], ids) != -1;
                    }));
                }
                else {
                    value.selectedItems.removeAll();
                }
            }
        });
    }

    $.fn.tabletogrid = function (settings, bindingContext) {
        settings = settings || {};
        $(this).each(function () {
            if (this.grid) { return; }
            var element = $(this).width('99%'),
                options = { datatype: 'local', colModel: [], colNames: [], height: 'auto', altRows: true },
                pagerOptions = ko.utils.extend({ target: '#pager', rowNum: 10, rowList: [10, 20, 50] }, settings.pager),
                idParamName = settings.rowid || 'id';

            pagerOptions.pager = $(pagerOptions.target).length == 0 ? null : pagerOptions.target;
            $.extend(options, pagerOptions, { width: element.width(), caption: $('caption', element).text(), localReader: { id: idParamName} });
            
            buildColModel(element, options, bindingContext);
            element.empty().jqGrid(options);
        });
    };

    function buildColModel(element, options, bindingContext) {
        var templates = $('td', element);
        $('th', element).each(function () {
            var source = $(this),
                col = source.attr('id') || source.data().field || $.trim($.jgrid.stripHtml(source.html())).split(' ').join('_'),
                model = { name: col, index: col, width: source.width() },
                template = templates.filter('[data-field="' + model.index + '"]');
            $.extend(model, source.data());
            if (template.length > 0) {
                model.template = template;
                model.formatter = createColumnFormatter(bindingContext);
            }
            options.colModel.push(model);
            options.colNames.push(source.html());
        });
    }

    function createColumnFormatter(bindingContext) {
        //use jqgrid support for custom formatters to enable knockout anonymous template syntax
        //http://www.trirand.com/jqgridwiki/doku.php?id=wiki:custom_formatter
        return function knockoutTemplate(cellval, opts, rwd) {
            if (opts.colModel[0]) {
                var element = $(opts.colModel[0]).clone();
                ko.applyBindingsToNode(element[0], { 'with': rwd }, bindingContext.$data);
                return element.html();
            }
            return cellval;
        };
    }
    
})(jQuery);