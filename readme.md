# New Relic Synthetic Whois DNS Checker

Demo project that checks DNS expiry via whois and reports as a metric to New Relic.

As the proejct requires a custom node module the script has to run in a private minion which has the module available. An example is included.

Some domains might need fixing up to deal with their response format which appears to vary.


For the insert into New Relic to work you will need an insert key. 

You can view the data with queries like `from Metric select latest(DNSCheck.days) facet DNSCheck.domain limit max `


