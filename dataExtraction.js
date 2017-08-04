const pg = require('pg');
const config = require('./config').config;
const connPool = new pg.Pool(config.pg);
const _ = require('lodash');
const redis = require('redis').createClient('redis://127.0.0.1:6379');
const Intercom = require('intercom-client');
const client = new Intercom.Client({ token: config.token });


let customerDataMapping = new Map();
let gidToUid = new Map();

function addEmptyPlaceHolderObject(element) {
	element.custom_attributes = {
		guest_id: null,
		is_from_guest: null,
		is_oauth_wechat: null,
		is_oauth_qq: null,


		num_orders: 0,
		total_payment: 0,
		category_slug_string: [],
		project_slug_string: [],
		//Should be split into two
		status_num_pending: 0, // -1
		status_num_pending_deleted: 0, // +1
		status_num_paid: 0,
		// status_num_drawing:0,
		status_num_waiting_for_delivery: 0,
		status_num_waiting_for_delivery_unpaid: 0,
		status_num_delivered: 0,
		status_num_waiting_for_pickup: 0,
		status_num_waiting_for_pickup_unpaid: 0,
		status_num_completed: 0,
		status_num_closed: 0,
		status_num_refund_pending: 0,
		status_num_refunded: 0,
		status_num_refund_failed: 0,

		promoter_username_string: [],
	};
	element.phone = null;
	element.user_id = null;
	element.created_at = null;
}


function idCheck(element){
	element.user_id = element.id;
	element.custom_attributes.guest_id = element.guest_id;
};

function isGuestPurchaseCheck(element) {
	element.custom_attributes.is_from_guest = false;
	if(element.guest_id > 0) {
		element.custom_attributes.is_from_guest = true;
	}
}

function removeUnusedFields(element) {
	//Should remove the unused fields
	config.unused_fields.forEach((field) => {
		//Removes the field in key/value pair in object
		delete element[field];
	});
}

function fullNameCheck(element) {
	if(element.first_name && element.last_name) {
		element.name = element.first_name + ' ' + element.last_name;
	}else{
		if(element.first_name) {
			element.name = element.first_name;
		}
		if(element.last_name) {
			element.name = element.last_name;
		}
		if(!element.first_name && !element.last_name) {
			element.name = '';
		}
	}
}

function phoneCheck(element) {
	if(element.mobile) {
		element.phone = element.mobile;
	}
}

function tppsCheck(element) {
	element.custom_attributes.is_oauth_wechat = false;
	element.custom_attributes.is_oauth_qq = false;
	if(element.tpps) {
		if(Object.keys(element.tpps).length === 0) {
			element.custom_attributes.is_oauth_wechat = false;
			element.custom_attributes.is_oauth_qq = false;
		}else{
			if(element.tpps.wechat) {
				element.custom_attributes.is_oauth_wechat = true;
			}
			if(element.tpps.qq) {
				element.custom_attributes.is_oauth_qq = true;
			}
		}
	}else{
		element.custom_attributes.is_oauth_wechat = false;
		element.custom_attributes.is_oauth_qq = false;
	}
}

function indLookup(element) {
	let ind = null;
	if(element.customer_id && element.guest_id) {
		ind = 'uid' + element.customer_id;
	}
	if(element.customer_id && !element.guest_id) {
		ind = 'uid' + element.customer_id;
	}
	//If gidToUid doesn't have gid + element.guest_id
	if(!element.customer_id && element.guest_id) {
		ind = gidToUid.has('gid' + element.guest_id) ? gidToUid.get('gid' + element.guest_id) : 'gid' + element.guest_id;
	}
	return ind;
}

function filter1(customerData) {
	console.log(customerData);
	customerData.forEach((element) => {
		//Should be at the beginning
		addEmptyPlaceHolderObject(element);

		idCheck(element);
		fullNameCheck(element);
		phoneCheck(element);
		isGuestPurchaseCheck(element);
		tppsCheck(element);

		removeUnusedFields(element);

		const tmp = Object.assign({}, element);

		if(element.user_id && element.custom_attributes.guest_id) {
			customerDataMapping.set('uid' + element.user_id, tmp);
			gidToUid.set('gid' + element.custom_attributes.guest_id, 'uid' + element.user_id);
		}

		if(!element.user_id && element.custom_attributes.guest_id) {
			customerDataMapping.set('gid' + element.custom_attributes.guest_id, tmp);
		}

		if(element.user_id && !element.custom_attributes.guest_id) {
			customerDataMapping.set('uid' + element.user_id, tmp);
		}
	});
	// console.log(customerData);
	console.log(customerDataMapping);
	console.log("---00----");
	console.log(gidToUid);
	return customerData;
}

function filter2(newQueryResult, customerData) {
	console.log(customerDataMapping);
	console.log("-----");
	newQueryResult.forEach((element) => {
		const ind = indLookup(element);
		console.log(customerDataMapping.get(ind).custom_attributes.category_slug_string);

		customerDataMapping.get(ind).custom_attributes.project_slug_string = _.union(element.project_slug_string, customerDataMapping.get(ind).custom_attributes.project_slug_string);
		customerDataMapping.get(ind).custom_attributes.category_slug_string = _.union(element.category_slug_string, customerDataMapping.get(ind).custom_attributes.category_slug_string);
		customerDataMapping.get(ind).custom_attributes.num_orders += Number.parseInt(element.num_orders);


		console.log(customerDataMapping.get(ind).custom_attributes.category_slug_string);
		console.log("good");
	});

	return customerData;
}


function filter3(newQueryResult, customerData) {
	newQueryResult.forEach((element) => {
		const ind = indLookup(element);

		const checkStatus = 'status_num_' + element.status;
		if(element.status === 'pending') {
			if(element.deleted_at) {
				checkStatus = checkStatus + '_deleted';
			}
			customerDataMapping.get(ind).custom_attributes[checkStatus] += 1;
		}else{
			customerDataMapping.get(ind).custom_attributes[checkStatus] += 1;
		}

		if(config.payment_items_included.includes(element.status)) {
			customerDataMapping.get(ind).custom_attributes['total_payment'] += Number.parseInt(element.payment);
		}

		if(typeof element.promoter_username_string === 'object' && element.promoter_username_string) {
			customerDataMapping.get(ind).custom_attributes.promoter_username_string = _.union(element.promoter_username_string, customerDataMapping.get(ind).custom_attributes.promoter_username_string);
		}else{
			if(!customerDataMapping.get(ind).custom_attributes.promoter_username_string.includes(element.promoter_username_string.toLowerCase())) {
				customerDataMapping.get(ind).custom_attributes.promoter_username_string.push(element.promoter_username_string.toLowerCase());
			}
		}

		// customerDataMapping.get(ind).custom_attributes.promoter_username_string = _.union(element.promoter_username_string, customerDataMapping.get(ind).custom_attributes.promoter_username_string);

		console.log("------------////");
		console.log(element.promoter_username_string);
		console.log(customerDataMapping.get(ind).custom_attributes.promoter_username_string);

	});

	return customerData;
}

function finishUp() {
	//Extract an array from the customerDataMapping


	//Iterate over the values list
	//Joins the array with ','
	customerDataMapping.forEach((element) => {
		element.custom_attributes.category_slug_string = element.custom_attributes.category_slug_string.join();
		element.custom_attributes.project_slug_string = element.custom_attributes.project_slug_string.join();
		element.custom_attributes.promoter_username_string = element.custom_attributes.promoter_username_string.join();

		if(element.custom_attributes.category_slug_string && element.custom_attributes.project_slug_string) {
			element.custom_attributes.category_slug_string = ',' + element.custom_attributes.category_slug_string + ',';
			element.custom_attributes.project_slug_string = ',' + element.custom_attributes.project_slug_string + ',';
		}
		if(!element.custom_attributes.category_slug_string && element.custom_attributes.project_slug_string) {
			element.custom_attributes.project_slug_string = ',' + element.custom_attributes.project_slug_string + ',';
		}
		if(element.custom_attributes.category_slug_string && !element.custom_attributes.project_slug_string) {
			element.custom_attributes.category_slug_string = ',' + element.custom_attributes.category_slug_string + ',';
		}
		if(element.custom_attributes.promoter_username_string) {
			element.custom_attributes.promoter_username_string = ',' + element.custom_attributes.promoter_username_string + ',';
		}

	});

	const result = [...customerDataMapping].map((x) => {
		return x[1];
	});

	return result;
}

function createUser(value) {
  // return new Promise((resolve) => {
  //   // setTimeout(() => {
  //   //   console.log("Resolving " + value);
  //   //   resolve(value);
  //   // }, Math.floor(Math.random() * 1000));
  // });
  console.log("creating user");
  console.log(value);

  return client.users.create(value)
  .then((r) => {
  	redis.hdel('userTable', value.user_id);
  }).catch((e) => {
  	console.log("err");
  	console.log(e);
  	console.log("A promise is not executed");
  	// createUser(value);

  });

  // return new Promise((resolve, reject) => {
  //   resolve(value);
  // }).then((r) => {
  // 	console.log("resolved");
  // 	console.log(value);
  // 	redis.hdel('userTable', value.user_id);
  // }).catch((e) => {
  // 	console.log("a promise is not executed");
  // });
}


function init() {
	//The first time the raw data is processed
	let promises = [];

	//TODO: Some process to retrieve userData from database
	connPool.query('SELECT array_to_json(array_agg(row_to_json(t))) from (SELECT * FROM public.customer) t', [], (err, result) => {
		if(err) {
			console.log("error message:");
			console.log(err);
		}else{
			console.log("succeeded");
			// console.log(result.rows[0].array_to_json[0]);
			let customerDataResult = filter1(result.rows[0].array_to_json);

			connPool.query(' SELECT customer_id, guest_id, COUNT(DISTINCT order_id) AS num_orders, array_agg(distinct project_slug) AS project_slug_string, array_agg(distinct category_slug) AS category_slug_string FROM( SELECT t4.order_id AS order_id, t4.customer_id AS customer_id, t4.guest_id AS guest_id, t4.project_slug AS project_slug, t6.slug AS category_slug FROM ( SELECT t1.id AS order_id, t1.customer_id AS customer_id, t1.guest_id AS guest_id, t3.project_slug AS project_slug, t3.project_id AS project_id FROM ( ( SELECT id, customer_id, guest_id FROM public.order) t1 LEFT JOIN ( SELECT id, guest_id FROM public.customer ) t2 ON t2.guest_id = t1.guest_id OR t2.id = t1.customer_id LEFT JOIN ( SELECT project_slug, project_id, id FROM public.order_detail ) t3 ON t1.id = t3.id ) ) t4 LEFT JOIN ( SELECT category_id, project_id FROM public.project_to_category ) t5 ON t4.project_id = t5.project_id LEFT JOIN ( SELECT slug, id FROM public.category ) t6 ON t5.category_id = t6.id ) t_total GROUP BY customer_id, guest_id;', [], (err, result) =>{
				filter2(result.rows, customerDataResult);
				// console.log(result.rows);
				connPool.query('SELECT t1.customer_id AS customer_id, t1.guest_id AS guest_id, t1.status AS status, t2.username AS promoter_username_string, t1.id AS id, t1.payment AS payment FROM(SELECT customer_id, guest_id, status, promoter_id, payment, id FROM public.order) t1, (SELECT username, id FROM public.promoter) t2 WHERE t1.promoter_id = t2.id;', [], (err, result) => {
					// console.log(result.rows);
					filter3(result.rows, customerDataResult);
					console.log("///////");
					// console.log(customerDataMapping);

					const res = finishUp();
					console.log("-------------The length");
					console.log(res.length);

				  var userData = res; //userData variable contains user data


				  userData.forEach((element) => {
				  	redis.hset('userTable', element.user_id, JSON.stringify(element));
				  });

				  userData.forEach((element) => {
				  	console.log("iter");
				  	console.log(createUser(element));
				  	promises.push(createUser(element));
				  });

				  Promise.all(promises)
				      .then((results) => {
				        console.log("All done", results);
				        redis.del('recoveryMode');
				      })
				      .catch((e) => {
				          // Handle errors here
				          console.log("There is one or more items rejected");
				      });


					// console.log(customerDataMapping);
				});
			});
		}
	});

}


function recover() {

	redis.hkeys('userTable', (err, result) => {
		if(err) {
			console.log("checkpoint 4");
		}else{
			console.log("Lengthy---");
			console.log(result.length);
			if(result.length === 0) {
				console.log("All records are written into intercom");
			}else{
				console.log("Still data left to be written");
				result.forEach((element) => {
					redis.hget('userTable', element, (err, resultEle) =>{
						if(err) {
							console.log("checkpoint 5");
						}else{
							createUser(resultEle);
						}
					});
				});
			}

		}
	});
}

redis.get('recoveryMode', (err, result)=>{
	if(err) {
		console.log("error break point 1");
	}else{
		console.log("whether");
		console.log(result);
		if(result){
			recover();
			console.log("enter recover");

			// redis.del('recoveryMode');

		}else{
			//Start from begining
			redis.set('recoveryMode', 'true', (err, result) => {
				if(err) {
					console.log(err);
					console.log("error break point 2");
				}else{
					init();
					//To make init is always run
					redis.del('recoveryMode');

					console.log("enter init");
				}
			});
		}
	}
});
