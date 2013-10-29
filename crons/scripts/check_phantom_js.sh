#!/bin/bash

##
## PhantomJS regulator
## Checks the procesing lenth time of phantomJS scripts and kills if longer than X
##

for time in `ps aux | grep phantomjs | grep -v grep | awk '{print $2"-"$10}'`;
do
	IFS='-' read -a ARR <<< "$time";
	PTIME=${ARR[1]};
	PID=${ARR[0]};

	SEC=`echo $PTIME | cut -d":" -f2`;
	MIN=`echo $PTIME | cut -d":" -f1`;
	TOTALTIMEINSEC=`echo $SEC+$MIN*60 | bc`;

	if [ $TOTALTIMEINSEC -gt '1000' ]; then
#		echo "$TOTALTIMEINSEC";
		echo "Kill it";
		echo "$PID";
		`kill -s 15 $PID`
	fi
done
