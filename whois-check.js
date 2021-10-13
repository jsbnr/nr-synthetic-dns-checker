
const domains = ["bbc.co.uk", "virginradio.co.uk", "newrelic.com"];


const INSERT_KEY= "YOU-NEWRELIC-INSERT-KEY-HERE" 
const NAMESPACE="DNSCheck"
const METRIC_API = "https://metric-api.newrelic.com/metric/v1" //US DC accounts
const DEFAULT_TIMEOUT = 10000  

/*
*  ========== LOCAL TESTING CONFIGURATION ===========================
*  This section allows you to run the script from your local machine
*  mimicking it running in the new relic environment. Much easier to develop!
*/


let RUNNING_LOCALLY = false
const IS_LOCAL_ENV = typeof $http === 'undefined';
if (IS_LOCAL_ENV) {  
  RUNNING_LOCALLY=true
  var $http = require("request");       //only for local development testing
  var $secure = {}                      //only for local development testing
  var $env = {}
  $env.LOCATION="local"
  console.log("Running in local mode")
} 

/*
* setAttribute()
* Sets a custom attribute on the synthetic record
*
* @param {string} key               - the key name
* @param {Strin|Object} value       - the value to set
*/
const setAttribute = function(key,value) {
  if(!RUNNING_LOCALLY) { //these only make sense when running on a minion
      $util.insights.set(key,value)
  } else {
      console.log(`[FAUX] Set attribute '${key}' to ${value}`)
  }
}

/*
* asyncForEach()
*
* A handy version of forEach that supports await.
* @param {Object[]} array     - An array of things to iterate over
* @param {function} callback  - The callback for each item
*/
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

/*
* genericServiceCall()
* Generic service call helper for commonly repeated tasks
*
* @param {number} responseCodes  - The response code (or array of codes) expected from the api call (e.g. 200 or [200,201])
* @param {Object} options       - The standard http request options object
* @param {function} success     - Call back function to run on successfule request
*/
const  genericServiceCall = function(responseCodes,options,success) {
  !('timeout' in options) && (options.timeout = DEFAULT_TIMEOUT) //add a timeout if not already specified 
  let possibleResponseCodes=responseCodes
  if(typeof(responseCodes) == 'number') { //convert to array if not supplied as array
    possibleResponseCodes=[responseCodes]
  }
  return new Promise((resolve, reject) => {
      $http(options, function callback(error, response, body) {
      if(error) {
          reject(`Connection error on url '${options.url}'`)
      } else {
          if(!possibleResponseCodes.includes(response.statusCode)) {
              let errmsg=`Expected [${possibleResponseCodes}] response code but got '${response.statusCode}' from url '${options.url}'`
              reject(errmsg)
          } else {
              resolve(success(body,response,error))
          }
        }
      });
  })
}


/*
* sendDataToNewRelic()
* Sends a metrics payload to New Relic
*
* @param {object} data               - the payload to send
*/
const sendDataToNewRelic = async (data) =>  {
  let request = {
      url: METRIC_API,
      method: 'POST',
      json: true,
      headers :{
          "Api-Key": INSERT_KEY
      },
      body: data
  }
  return genericServiceCall([200,202],request,(body,response,error)=>{
      if(error) {
          console.log(`NR Post failed : ${error} `)
          return false
      } else {
          return true
      }
      })
}




(async function(){
	const whois = require('whois-json');

  setAttribute("candidateDomains",domains.length)
    let whoisResults=[]
    await asyncForEach(domains,async (domain,idx)=>{
        var results = await whois(domain, {follow: 0, verbose: true});
	    //console.log(`${idx}: `+JSON.stringify(results, null, 2));
      whoisResults.push({name: domain, results: results})
    })


    let commonMetricBlock={"attributes": {}}
    commonMetricBlock.attributes[`tool`]=NAMESPACE 

    let goodDomains=0

    let unixTimeNow=Math.round(Date.now()/1000)
    let metricsInnerPayload=whoisResults.map((domain)=>{
        let metricPayload =  {
            name: `${NAMESPACE}.days`,
            type: "gauge",
            value: 0,
            timestamp: unixTimeNow,
            attributes: {}
        }

        metricPayload.attributes[`${NAMESPACE}.domain`]=domain.name
        metricPayload.attributes[`${NAMESPACE}.location`]=$env.LOCATION
        if(domain.results && domain.results[0]) {


          let expiryDays = 0 
          let expiryFound = false
          if(domain.results[0].data.registryExpiryDate !== undefined) {
            let expiryDate=new Date(domain.results[0].data.registryExpiryDate)
            let expiryTS=expiryDate/1000
            expiryDays = Math.floor((expiryTS-unixTimeNow) / 60 / 60 /24)
            console.log(`${domain.name} expires ${domain.results[0].data.registryExpiryDate} which is in ${expiryDays} days`) 
            expiryFound=true
          }

          if(domain.results[0].data.expiryDate !== undefined) {
            let expiryDate=new Date(domain.results[0].data.expiryDate)
            let expiryTS=expiryDate/1000
            expiryDays = Math.floor((expiryTS-unixTimeNow) / 60 / 60 /24)
            console.log(`${domain.name} expires ${domain.results[0].data.expiryDate} which is in ${expiryDays} days`) 
            expiryFound=true
          }

          if(expiryFound) {
            goodDomains++
          } else {
            console.log(`Error unkown response type for ${domain.name}`)
            console.log(domain.results[0])
          }

          metricPayload.value=expiryDays

          metricPayload.attributes[`${NAMESPACE}.whoisServer`]=domain.results[0].server
          if(domain.results[0].data.registrarWhoisServer) { metricPayload.attributes[`${NAMESPACE}.registrarWhoisServer`]=domain.results[0].data.registrarWhoisServer }
          if(domain.results[0].data.registrar) { metricPayload.attributes[`${NAMESPACE}.registrar`]=domain.results[0].data.registrar }
          if(domain.results[0].data.creationDate) { metricPayload.attributes[`${NAMESPACE}.creationDate`]=domain.results[0].data.creationDate }
          if(domain.results[0].data.updatedDate) { metricPayload.attributes[`${NAMESPACE}.updatedDate`]=domain.results[0].data.updatedDate }
          if(domain.results[0].data.lastUpdated) { metricPayload.attributes[`${NAMESPACE}.updatedDate`]=domain.results[0].data.lastUpdated }
          if(domain.results[0].data.domainStatus) { metricPayload.attributes[`${NAMESPACE}.domainStatus`]=domain.results[0].data.domainStatus }
          if(domain.results[0].data.nameServer) { metricPayload.attributes[`${NAMESPACE}.nameServer`]=domain.results[0].data.nameServer }
          if(domain.results[0].data.nameServers) { metricPayload.attributes[`${NAMESPACE}.nameServer`]=domain.results[0].data.nameServers }
          if(domain.results[0].data.registryExpiryDate) { metricPayload.attributes[`${NAMESPACE}.expiryDate`]=domain.results[0].data.registryExpiryDate }
          if(domain.results[0].data.expiryDate) { metricPayload.attributes[`${NAMESPACE}.expiryDate`]=domain.results[0].data.expiryDate }
          metricPayload.attributes[`${NAMESPACE}.error`]=false
          } else {
            metricPayload.attributes[`${NAMESPACE}.error`]=true
          }
        return metricPayload
    })

    let metricsPayLoad=[{ 
        "common" : commonMetricBlock,
        "metrics": metricsInnerPayload
    }]

    //console.log(JSON.stringify(metricsPayLoad))
    let NRPostStatus = await sendDataToNewRelic(metricsPayLoad)
    if( NRPostStatus === true ){
       console.log("NR Post successful")   
   } else {
       assert.fail("NR Post failed")
   }

   setAttribute("goodDomains",goodDomains)
   if(goodDomains == domains.length) {
     console.log("All domains processed")
   } else {
     assert.fail("Some domains failed")
   }
    setAttribute("scriptCompleted",true)
})()