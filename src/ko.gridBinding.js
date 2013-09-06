//knockout binding
(function ($) {
    ko.bindingHandlers.jqGrid = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var value = valueAccessor(),
                onPaged = false,
                fireMutation = false,
                $element = $(element);

            $element.tabletogrid(value, bindingContext);
            subscribeToSelectEvents($element, value);

            $element.jqGrid('setGridParam', {
                onPaging: function() {
                    onPaged = true;
                }
            });

            ko.utils.registerEventHandler(element, 'jqGridGridComplete', function () {
                if (onPaged) {
                    // set up the binding for each grid row
                    applyBindingsToGrid($element, viewModel);
                }
            });

            ko.utils.registerEventHandler(element, 'jqGridSortCol', function () {
                fireMutation = true;
                $element.data('doSort', true);
            });

            ko.utils.registerEventHandler(element, 'jqGridAfterLoadComplete', function () {
                if (fireMutation) {
                    fireMutation = false;
                    setTimeout(function () {
                        value.data.valueHasMutated();
                    }, 0);
                }
            });

            ko.utils.registerEventHandler(element, 'jqGridFilterSearch jqGridFilterReset', function (e) {
                if (e.type === 'jqGridFilterSearch') {
                    $element.siblings('.filteredContent').remove();
                    $element.before('<div class="filteredContent ui-widget-content ui-state-hover"><div class="filteredText">Results are filtered</div></div>');
                } else {
                    $element.siblings('.filteredContent').remove();
                }
                setTimeout(function () {
                    applyBindingsToGrid($element, viewModel);
                }, 0);
            });

            ko.utils.registerEventHandler(element, 'reloadGrid', function (e) {
                // set up the binding for each grid row
                setTimeout(function () {
                    applyBindingsToGrid($element, viewModel);
                }, 0);
            });

            //tell knockout to ignore descendants of this element
            //return { controlsDescendantBindings: true };
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel) {
            var value = valueAccessor(),
                griddata = ko.utils.unwrapObservable(value.data) || [],
                $element = $(element),
                prevgriddata = $element.data('prevgriddata') || [],
                data = ko.toJS(griddata),
                doSort = $element.data('doSort');

            if (doSort) {
                $element.removeData('doSort');
            }

            $element.data('prevgriddata', data);

            // only update the grid if the data has changed
            if (doSort || (JSON.stringify(data) !== JSON.stringify(prevgriddata))) {

                if (!doSort) { // don't clear the grid if we're sorting
                    $element.clearGridData()
                }
                $element.setGridParam({ data: data });
                setTimeout(function () {
                    $element.trigger('reloadGrid');
                }, 0);
                clearSelectedItems(value);

            }

        }
    };

    function applyBindingsToGrid($element, viewModel) {
        $element.find('tr.jqgrow').each(function () {
            var rowId = this.id,
                rowData = $element.jqGrid('getRowData', rowId);
            ko.applyBindingsToNode(this, { 'with': rowData }, viewModel);
        });
    };

    function clearSelectedItems(value) {
        if (value.selectedItems) {
            value.selectedItems([]);
        };
    };

    function subscribeToSelectEvents($element, value) {
        var idParamName = $element.getGridParam('localReader').id;
        $element.jqGrid('setGridParam', {
            onSelectRow: function (id, selected) {
                var data = ko.utils.unwrapObservable(value.data) || {},
                    selectedItem = ko.utils.arrayFirst(data, function (item) {
                        return item[idParamName] == id;
                    });

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
        $element.jqGrid('setGridParam', {
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
            var element = $(this),
                options = $.extend(settings,
                {
                    datatype: settings.datatype || 'local',
                    colModel: [],
                    colNames: [],
                    height: settings.height || 'auto',
                    pager: settings.pager || '#pager',
                    pagerOptions: settings.pagerOptions || { edit: false, add: false, del: false, refresh: false },
                    searchOnEnter: true,
                    altRows: settings.altRows || true,
                    width: settings.width || element.width(),
                    caption: settings.caption || $('caption', element).text(),
                    localReader: settings.localReader || { id: settings.rowid || 'id' },
                    filterToobar: settings.filterToolbar || false
                });
            
            buildColModel(element, options, bindingContext);
            element.empty().jqGrid(options);

            if (options.pagerOptions) {
                element.jqGrid('navGrid', options.pager, options.pagerOptions);
            }
            
            if (options.filterToolbar) {
                element.jqGrid('filterToolbar', {
                    afterSearch: function () {
                        applyBindingsToGrid(element, bindingContext);
                    }
                });
            }

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
            if (model.searchoptions) {
                model.searchoptions = JSON.parse(model.searchoptions.replace(/\'/g, '"'));
            }
            options.colModel.push(model);
            options.colNames.push(source.html());
        });
    };

    function createColumnFormatter(bindingContext) {
        //use jqgrid support for custom formatters to enable knockout anonymous template syntax
        //http://www.trirand.com/jqgridwiki/doku.php?id=wiki:custom_formatter
        return function knockoutTemplate(cellval, opts, rwd) {
            if (opts.colModel[0]) {
                var element = $(opts.colModel[0]).clone(true, true);
                ko.applyBindingsToNode(element[0], { 'with': rwd }, bindingContext.$data);
                return element.html();
            }
            return cellval;
        };
    };

    ko.bindingHandlers.jqGridResetSelection = {
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var value = ko.utils.unwrapObservable(valueAccessor()) || {},
                gridSelector = ko.utils.unwrapObservable(value.grid) || null,
                reset = ko.utils.unwrapObservable(value.reset) || false,
                $grid = $(gridSelector);

            if (reset) {
                $grid.jqGrid('resetSelection');
            }
        }
    };

    ko.bindingHandlers.jqGridShowLoading = {
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var value = ko.utils.unwrapObservable(valueAccessor()) || {},
                gridSelector = ko.utils.unwrapObservable(value.grid) || null,
                showLoading = ko.utils.unwrapObservable(value.showLoading) || false,
                $grid = $(gridSelector),
                $loading = $grid.closest('.ui-jqgrid-view').siblings('.loading');

            if (showLoading) {
                $loading.show();
            } else {
                $loading.hide();
            }
        }
    };

    ko.bindingHandlers.jqGridResetSearchFilter = {
        update: function (element, valueAccessor, allBindingAccessor, viewModel, bindingContext) {
            var value = ko.utils.unwrapObservable(valueAccessor()) || {},
                gridSelector = ko.utils.unwrapObservable(value.grid) || null,
                reset = ko.utils.unwrapObservable(value.reset) || false,
                $grid = $(gridSelector);

            if (reset) {
                $grid
                    .closest('.ui-jqgrid')
                    .find('.searchFilter')
                    .siblings('table')
                    .find('.ui-icon-arrowreturnthick-1-w')
                    .click();
            }
        }
    };

})(jQuery);
