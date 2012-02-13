# jgGrid Binding

A grid binding plugin for Knockout.js provides basic integration with the JqGrid plugin for jQuery.

Features include: Binding to an observable array of items, progressive enhancement of an existing table (using an extension of the jqgrid tabletogrid feature), selected item and mulit-select items binding, and templated column support.

##Usage

The grid binding plug uses the markup of the table to internally derive an appropriate column model for jqgrid to work upon. The data-field attribute denotes the property of each array item to bind a column to, and its header text will carry into the rendered table. A th element is required for each column desired in the rendered table. Optionally, a template can be specified for any column by providing a binding template for the column inside of the tbody element. NB: any inline column widths/styles will be carried into jqgrids column model, and applied to the resultant grid.

###Markup

    <div id="pager"></div>
    <table id="animals" data-bind="grid: { data: animals }" >
        <caption>Amazing Animals</caption>
        <thead> 
            <tr> 
                <th data-field="actions" style="width:27px;"></th>
                <th data-field="name" width="150px">Item Name</th> 
                <th data-field="sales">Sales Count</th> 
                <th data-field="price">Price</th> 
            </tr> 
        </thead> 
        <tbody>
            <tr>
                <td data-field="actions">
                    <a class="grid-edit" data-bind="attr:{ href: 'animals/' + id, title: name }, text: id"></a>
                </td>
            </tr>
        </tbody>
    </table>

###JavaScript

    $(function () {
        var dataService = //some service to load data
        var viewModel = {
            animals: ko.observableArray([]),
        };
 
        dataService.GetAnimals(function (result) {
            viewModel.animals(result);
        });
 
        ko.applyBindings(viewModel);
    });


###Examples
For more info and usage examples, see the examples directory.

###Dependencies
* Knockout 2.0
* Jquery 1.6+
* jqGrid
