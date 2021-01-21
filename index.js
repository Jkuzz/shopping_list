/*
 *  Sends a request to the rest-api, which handles database querying
 *  returnes promise decodes json response and
 *      rejects on successful connection but unsuccessful query
 */
function databaseQuery(action, requestBody = null) {
    if (!action) return null;
    let requestInit = {}
    if (requestBody) {
        let fd = new FormData();
        for (key in requestBody) {
            fd.append(key, requestBody[key]);
        }
        requestInit = {
            method: 'POST',
            // headers: {
            //     'Accept': 'application/json',
            //     'Content-type': 'application/json'
            // },
            // body: JSON.stringify({requestBody})
            body: fd
        };
    }
    let promise = new Promise((resolve, reject) => {
        fetch('./restapi/index.php?action=' + action, requestInit)
            .then(response => response.json())
            .then(data => {
                if (data.ok) resolve(data.payload);
                else reject(data.error);
            })
            .catch(error => {reject(error)});
    });
    return promise;
}


/*
 * Finds name of item based on provided id
 * might be better to use a map
 */
function itemIdToName(knownItems, idToFind) {
    for (let item of knownItems) {
        if (item.id === idToFind)
            return item.name;
    }
}


/*
 * Creates on-click function for list item delete buttons
 */
function makeDeleteButtonClick(idToDelete, row) {
    return () => {
        let deletePromise = databaseQuery('delete', {id: idToDelete});
        deletePromise.then(row.remove())
            .catch(error => window.alert(error));
    }
}


/*
 * Swaps visibility of edit, delete and save buttons of given row
 */
function swapRowButtons(row) {
    if (row.querySelector('.edit .btn-save').style.display === 'none') {
        row.querySelector('.edit .btn-edit').style.display = 'none';
        row.querySelector('.edit .btn-delete').style.display = 'none';
        row.querySelector('.edit .btn-save').style.display = 'inline';
    } else {
        row.querySelector('.edit .btn-edit').style.display = 'inline';
        row.querySelector('.edit .btn-delete').style.display = 'inline';
        row.querySelector('.edit .btn-save').style.display = 'none';
    }
}


/*
 * Creates on-click function for list item save buttons
 */
function makeSaveButtonClick(idToSave, row, oldValue) {
    return () => {
        let inputField = row.querySelector('input');
        let amountDiv = row.querySelector('.amount div');
        if (inputField.value !== '' && !isNaN(inputField.value)) {
            let updatePromise = databaseQuery('amount', {'id': idToSave, 'amount': inputField.value});
            updatePromise.then(() => {amountDiv.textContent = inputField.value})
            .catch(error => {
                amountDiv.textContent = oldValue;
                window.alert(error);
            });
        } else
            amountDiv.textContent = oldValue;

        inputField.style.display = 'none';
        amountDiv.style.display = 'inline';
        swapRowButtons(row);
    }
}


/*
 * Creates on-click function for list item edit buttons
 */
function makeEditButtonClick(idToEdit, row) {
    return () => {
        let inputField = row.querySelector('input');
        let amountDiv = row.querySelector('.amount div');
        inputField.value = amountDiv.textContent;
        inputField.style.display = 'inline';
        amountDiv.style.display = 'none';
        inputField.focus();

        swapRowButtons(row);
        row.querySelector('.edit .btn-save').onclick = makeSaveButtonClick(idToEdit, row, amountDiv.textContent);
    }
}


/*
 * Creates functions for move buttons to move rows in table
 */
function makeMoveButtonClick(row, direction, idToMove) {
    if (direction === 'up') {
        return () => {
            let prevRow = row.previousSibling;
            if (prevRow && prevRow.tagName === 'TR') { // if it's not first
                let movePromise = databaseQuery('move', {id: idToMove, direction: 'up'})
                movePromise.then(() => {
                    let table = row.parentNode;
                    table.removeChild(row);
                    table.insertBefore(row, prevRow);
                })
                .catch(error => window.alert(error));
            }
        }
    } else if (direction === 'down') {
        return () => {
            let nextRow = row.nextSibling;
            if (nextRow && nextRow.tagName === 'TR') { // if it's not last
                let movePromise = databaseQuery('move', {id: idToMove, direction: 'down'})
                movePromise.then(() => {
                    let table = row.parentNode;
                    table.removeChild(row);
                    if (nextRow.nextSibling)
                        table.insertBefore(row, nextRow.nextSibling);
                    else
                        table.appendChild(row);
                })
                .catch(error => window.alert(error));
            }
        }
    }
}


/*
 * Generates onclick functions for all buttons in the new row.
 */
function makeButtonClicks(row, listItem, knownItems) {
    row.querySelector('#amount-td div').textContent = listItem.amount;
    row.querySelector('#name-td').textContent = itemIdToName(knownItems, listItem.item_id);
    row.querySelector('.edit .btn-delete').onclick = makeDeleteButtonClick(listItem.item_id, row)
    row.querySelector('.edit .btn-edit').onclick = makeEditButtonClick(listItem.item_id, row)
    row.querySelector('.movement .btn-up').onclick = makeMoveButtonClick(row, 'up', listItem.item_id)
    row.querySelector('.movement .btn-down').onclick = makeMoveButtonClick(row, 'down', listItem.item_id)
}


/*
 * Makes hidden number input for editing list item amount.
 * This exists because cloneNode() wouldn't clone the input element.
 */
function makeInputField(row) {
    let newInput = document.createElement('input');
    newInput.setAttribute('type', 'number');
    newInput.setAttribute('class', 'amount-input-edit');
    newInput.setAttribute('maxlength', 4);
    newInput.style.display = 'none';
    newInput.addEventListener('keydown', event => {
        if (event.key === 'Enter')
            row.querySelector('.edit .btn-save').click();
    });
    row.querySelector('#amount-td').appendChild(newInput);
}


/*
 * Comparison function for list items
 */
function positionCompare(a, b) {
    return a.position - b.position;
}


window.addEventListener('DOMContentLoaded', () => {
    let rowTemplate = document.querySelector('#data-table-body tr');
    document.getElementById('data-table-body').deleteRow(0);
    rowTemplate.querySelector('.edit .btn-save').style.display = 'none';

    listContentsPromise = databaseQuery('list');
    itemsPromise = databaseQuery('items');

    Promise.all([listContentsPromise, itemsPromise]).then(response => {
        let listContent = response[0].sort(positionCompare);
        let knownItems = response[1];
        for (let listItem of listContent) {
            let newRow = rowTemplate.cloneNode(true);
            makeInputField(newRow);
            makeButtonClicks(newRow, listItem, knownItems);
            document.getElementById('data-table-body').appendChild(newRow);
        }

        for (let item of knownItems) {
            let newOption = document.createElement('option');
            newOption.setAttribute('value', item.name)
            document.querySelector('#add-item tbody #add-name datalist').appendChild(newOption);
        }
    })
    .catch(() => window.alert("Failed to fetch data from the database."));
})
