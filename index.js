const Intercom = require('intercom-client');
const config = require('./config').config;
// console.log(config);

const client = new Intercom.Client({ token: config.token });

const redis = require('redis').createClient('redis://127.0.0.1:6379');


const mockData = [
	{
		user_id: 'id1',
		name: 'jane doe',
		email: 'janedoe1@abc.com',
		phone: '12345678',
		custom_attributes: {
			guest_id: 'guest1',
			purchase_times: 10,
			// products_list: [
			// 	{
			// 		product_name: 'SHANGHAI ROLEX MASTERS',
			// 		product_alias: 'shanghai-rolex-masters',
			// 	}, 
			// 	{
			// 		product_name: 'SUMMER SONIC 2017 SHANGHAI',
			// 		product_alias: 'summer-sonic-shanghai',
			// 	}
			// ],
			// product_category: [
			// 	{
			// 		category_name: 'SHANGHAI ROLEX MASTERS',
			// 		category_alias: 'shanghai-rolex-masters'
			// 	}, 
			// 	{
			// 		category_name: 'SUMMER SONIC 2017 SHANGHAI',
			// 		category_alias: 'summer-sonic-shanghai',
			// 	}
			// ]
		}
	},
	{
		user_id: 'id2',
		name: 'jane doe2',
		email: 'janedoe2@gjh.com',
		phone: '',
		custom_attributes: {
			guest_id: 'guest2',
			purchase_times: 20,
			// products_list: [
			// 	{
			// 		product_name: '13th JZ Festival Shanghai',
			// 		product_alias: 'jz-festival-2017',
			// 	}, 
			// 	{
			// 		product_name: 'Story Telling by Chinese Elderly',
			// 		product_alias: 'story-telling-chinese-elderly',
			// 	}
			// ],
			// product_category: [
			// 	{
			// 		category_name: '13th JZ Festival Shanghai',
			// 		category_alias: 'jz-festival-2017'
			// 	}, 
			// 	{
			// 		category_name: 'Story Telling by Chinese Elderly',
			// 		category_alias: 'story-telling-chinese-elderly',
			// 	}
			// ]
		}
	},
	{
		user_id: 'id3',
		name: 'jane doe3',
		email: '',
		phone: '0549680204',
		custom_attributes: {
			guest_id: 'guest3',
			purchase_times: 10,
			// products_list: [
			// 	{
			// 		product_name: 'SHANGHAI ROLEX MASTERS',
			// 		product_alias: 'shanghai-rolex-masters',
			// 	}, 
			// 	{
			// 		product_name: 'SUMMER SONIC 2017 SHANGHAI',
			// 		product_alias: 'summer-sonic-shanghai',
			// 	}
			// ],
			// product_category: [
			// 	{
			// 		category_name: 'SHANGHAI ROLEX MASTERS',
			// 		category_alias: 'shanghai-rolex-masters'
			// 	}, 
			// 	{
			// 		category_name: 'SUMMER SONIC 2017 SHANGHAI',
			// 		category_alias: 'summer-sonic-shanghai',
			// 	}
			// ]
		}
	},
	{
		user_id: 'id4',
		name: 'jane doe4',
		email: '',
		phone: '',
		custom_attributes: {
			guest_id: 'guest4',
			purchase_times: 0,
			// products_list: [],
			// product_category: []
		}
	}
];


//Some code to generate an array of users

// [{
//   user_id: string (=>id),
//   custom_attributes: {
//     is_from_guest: string (=>guest_id),
//	   is_oauth_wechat: bool (),
//	   is_oauth_qq: bool ()
//   },
//   name: string(=>(CONCAT(first_name, last_name)) after concatenation),
//   email: string (optional),
//   phone: string (optional)
// }]

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


  var userData = mockData; //userData variable contains user data


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
}

function recover() {
	redis.hkeys('userTable', (err, result) => {
		if(err) {
			console.log("checkpoint 4");
		}else{
			result.forEach((element) => {
				redis.hget('userTable', element, (err, result) =>{
					if(err) {
						console.log("checkpoint 5");
					}else{
						createUser(result);
					}
				});
			});
		}
	});
}


// redis.get('recoveryMode', (err, result)=>{
// 	if(err) {
// 		console.log("error break point 1");
// 	}else{
// 		if(result){
// 			recover();
// 			console.log("enter recover");

// 			redis.del('recoveryMode');
			
// 		}else{
// 			//Start from begining
// 			redis.set('recoveryMode', 'true', (err, result) => {
// 				if(err) {
// 					console.log(err);
// 					console.log("error break point 2");
// 				}else{
// 					init();
// 					console.log("enter init");

// 				}
// 			});
// 		}
// 	}
// });


// client.users.update({
// 	email: 'janedoe1@abc.com',
// 	custom_attributes: {
// 		project_shanghai_rolex: 'shanghai-rolex'
// 	}
// }).then((r) => {
// 	console.log("succ");
// }).catch((e) => {
// 	console.log("Err");
// 	console.log(e);
// })


// client.users.find({email: 'janedoe1@abc.com'}).then((r) => {
// 	console.log(r);
// });

