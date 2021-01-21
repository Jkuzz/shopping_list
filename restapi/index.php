<?php

define('DATA_FILE', __DIR__ . '/data.json');


/**
 * Create and send JSON response.
 */
function json_response($payload = null, $error = '')
{
	header('Content-Type: application/json');
	$res = [ 'ok' => !$error ];
	if ($error) $res['error'] = $error;
	if ($payload) $res['payload'] = $payload;
	echo json_encode($res);
	exit;
}


/**
 * Save internal data back to data file.
 */
function save_data($data)
{
	file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT));
}


/**
 * Safe way how to fetch value from an array and validate it via regex.
 */
function safe_get(array $params, string $name, $default = null, $regexCheck = null)
{
	if (!array_key_exists($name, $params)) return $default;
	if ($regexCheck && !preg_match($regexCheck, $params[$name])) return $default;
	return $params[$name];
}


/*
 * Fetches all data from table and formats it into array.
 * Does not sanitize $table input
 */
function fetch_from_database($dbConn, $table)
{
	$result = $dbConn->query("SELECT * FROM $table");
	$data = [];
	while($row = $result->fetch_assoc()) {
		$data[] = $row;
	}
	return $data;
}


/*
 * REST API Methods
 */

/**
 * Retrieve current content of the shopping list.
 */
function rest_get_list($dbConn)
{
	$list = fetch_from_database($dbConn, 'list');
	json_response($list);
}


/**
 * Retrieve all known items.
 */
function rest_get_items($dbConn)
{
	$items = fetch_from_database($dbConn, 'items');
	json_response($items);
}


/**
 * Update the amount for given record.
 */
function rest_post_amount($dbConn)
{
	$id = safe_get($_POST, 'id', null, '/^[0-9]{1,10}$/');
	$amount = safe_get($_POST, 'amount', null, '/^[0-9]{1,10}$/');
	if ($id) {
		if ($amount) {
			$result = $dbConn->query("UPDATE list SET amount='$amount' WHERE item_id='$id';");
			if ($result) json_response();
			else json_response(null, 'Update failed in database!');
		} else
			json_response(null, "Invalid amount value provided.");
	} else
		json_response(null, 'Invalid id!');
}


/*
 * Deletes an item from the list and decrements following items' position.
 */
function rest_post_delete($dbConn)
{
	$idToRemove = safe_get($_POST, 'id', null, '/^[0-9]{1,10}$/');
	if ($idToRemove) {
		$result = $dbConn->query("CALL removeFromList($idToRemove);");
		if ($result) json_response();
		else json_response(null, 'Deletion failed in database!');
	} else
		json_response(null, 'Invalid id!');
}


/*
 * Moves the item with appropriate id, only if the move is legal.
 */
function rest_post_move($dbConn)
{
	$idToMove = safe_get($_POST, 'id', null, '/^[0-9]{1,10}$/');
	$direction = safe_get($_POST, 'direction', null, '/^(up|down)$/');

	if ($idToMove) {
		if ($direction) {
			$dir = (int)($direction === 'down');
			$result = $dbConn->query("CALL moveInList($idToMove, $dir);");
			if ($result) json_response();
			else json_response(null, 'Move failed in database!');
		} else
			json_response(null, 'Invalid direction provided!');
	}
	else
		json_response(null, 'Invalid id!');
}


/**
 * Add a new Record to the list and to the known items.
 */
function rest_post_default($dbConn)
{
	$name = safe_get($_POST, 'name', null, '/^[a-z A-Z_\']{1,100}$/');
	$amount = safe_get($_POST, 'amount', null, '/^[0-9]{1,4}$/');

	if ($name) {
		if ($amount) {
			$statement = $dbConn->prepare("CALL addToList(?, ?)");
			$statement->bind_param('si', $name, $amount);
			$statement->execute();

			if ($dbConn->errno !== 0)
				json_response(null, "Database connection failed.");

			http_response_code(302);
			header("Location: ../index.html");
    		die();
		} else {
			$statement = $dbConn->prepare("INSERT IGNORE INTO items (name) VALUES (?)");
			$statement->bind_param('s', $name);
			$statement->execute();
			json_response(null, "Invalid amount value provided.");
		}
	} else
		json_response(null, 'Invalid name!');

}


/**
 * Main function.
 */
function run()
{
    require_once('./dbconfig.php');
    $dbConn = new mysqli($db_config['server'], $db_config['login'], $db_config['password'], $db_config['database']);
    if ($dbConn->connect_error)
        json_response(null, 'Could not connect to the database.');

	$action = safe_get($_GET, 'action', 'default', '/^[a-z_]+$/');
	$method = strtolower($_SERVER['REQUEST_METHOD']);
	$target = "rest_${method}_${action}";

	if (function_exists($target))
		$target($dbConn);
	else
		json_response(null, 'Target action or method is not available.');
}


try {
	run();
}
catch (Exception $e) {
	http_response_code(500);
	header('Content-Type: text/plain');
	echo $e->getMessage();
}
