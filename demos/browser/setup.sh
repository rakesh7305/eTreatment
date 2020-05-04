#!/bin/sh

for f in \
package.json \
server.js \
style.scss \
webpack.config.js 
do
echo "Copying ${f}"
#ls -l  /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}
#ls -l  /home/ec2-user/eTreatment/demos/browser/${f}
mv /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f} /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}.save
cp -p /home/ec2-user/eTreatment/demos/browser/${f}  /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}
#ln -s /home/ec2-user/eTreatment/demos/browser/${f}  /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}
done

echo "Linking new files"

mkdir /home/ec2-user/amazon-chime-sdk-js/demos/browser/app/etreat

for f in \
server_mysql.js \
app/etreat/etreat.html \
app/etreat/etreat.ts
do
echo "Copying ${f}"
#ls -l  /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}
#ls -l  /home/ec2-user/eTreatment/demos/browser/${f}
#ln -s /home/ec2-user/eTreatment/demos/browser/${f}  /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}
cp -p /home/ec2-user/eTreatment/demos/browser/${f}  /home/ec2-user/amazon-chime-sdk-js/demos/browser/${f}
done






#install MySQL server
#yum install mysql-server
#And when you are prompted, type ‘y’.
#Then configure mysql server to start up automatically on reboot if you want.
#chkconfig mysqld on
#Then start the MySQL
#service mysqld start
#If everything went successfully you will see following message on the console.
#Starting mysqld: [ OK ]
#Update password on your local MySQL server if you want,
#mysqladmin -u root password [your_new_pwd]
#Now we have installed MySQL server into our EC2 instance. Then we try to connect to login to the mysql server. If you have created a root user password then we can login to the MySQL as follows:
#mysql -uroot -p
#Then you will ask for the root user password and then enter password, then you should see a output as follows.

npm install mysql
npm install --save datatables.responsive.typings
npm install datatables.net-responsive
npm install compression@1.7.4^C
npm install uuidv4
