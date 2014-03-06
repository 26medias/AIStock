# AIStock #

A experiemental prototype of a semi-trained Artificial Intelligence that monitors twitter and the stock market, and learns to correlate the two in order to predict the direction of the market in real time, and for any stock it was made to monitor.

The operation hapens in 3 major steps. First, the AI learns to differenciate between relevant and irrelevant tweets in a financial context. Then, it learns to differenciante positive, negative and neutral tweets from the relevant group. Finally, it derivates rules by comparing the tweets to various processed financial data.

## Dependencies ##
* MongoDB
* Redis
* NodeJS

## installation ##
`npm install`

## Run the server ##
`node main.js -online false -monitor true -timeout 20000 -threads 1 -debug_mode true -db aistock -mongo_remote false`

## interface ##
The web interface is static HTML is located in `/build`.

Sources in `/src`, compiled using `node build.js` executed from `/bin`.


Let it run for a while first, to let it stream a few tweets, before you start training the AI.

## Training the AI ##
You have 2 kinds of training to do: First, you need to train the AI to differenciate a relevant from an irrelevant tweet. That needs to be done for each stock. Then, you need to train the AI to differenciate positive, negative and neutral tweets.
After a couple hundreds of training exemples, the AI should start being pretty good at categorizing the tweets.

## Monitoring stocks ##
There is no interface yet to manage the monitoring of stocks and keywords.

Use the API interface:

Example: Track Zynga's stock on yahoo finance, with the keywords '$znga' and 'zynga' on twitter:

`127.0.0.1:2014/interface/track?symbol=ZNGA&keywords=["$znga","zynga"]`