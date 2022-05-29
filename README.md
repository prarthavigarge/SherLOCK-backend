# SherLOCK-backend
![image](https://user-images.githubusercontent.com/78611945/170862590-4c421dcb-4227-4fb9-bc58-a61626b46f42.png)

Backend for sherLOCK- crime prevention application for the safety of women.

## Why sherLOCK

One in two women felt unsafe walking alone after dark in a quiet street or using public transport back home being unsure of their driver, or being followed by a someone. A study reveals that for most women, a possibility that the person could have previously offended a woman and may do so again sits back at of their mind.
A vast majority of offenders have difficulty staying on a law-abiding path even after being released from the prison. 

Our app idea helps women scan the or upload the picture of a suspect and tells back whether the person has been convicted for any crime before along with the crimes committed and the danger level of the crime.

## Features of the app

1) Scan or upload a picture of the suspect
2) Compare with database to find a match
3) If the match is found display the following details:
        - picture of the suspect in database along with the picture uploaded by the user for verification
        - the danger level of the suspect calculated based on the crimes committed by the suspect
        - the crimes that the suspect has been convicted for
4) Incase of no match found display the appropriate message.

## Backend Features

1) Route which uses face recognition package to match faces between the uploaded picture and pictures in database
2) Route through which criminals can be added to the database, with required data and derived data.
3) Appropriate limitations to files uploaded to server and to the aws file hosting service

## Important Links

1) Design File Link: https://www.figma.com/file/jPIayLBgMEy99lz8AjVyuq/sherLOCK?node-id=0%3A1
2) sherLOCK Frontend: https://github.com/prarthavigarge/SherLOCK-Frontend.git
3) Face Recognition API used: https://www.npmjs.com/package/@vladmandic/face-api 
                                (uses Tensorflow/JS)

## Instructions to Run

1) git clone the repository
2) open the project on your system
3) run "npm install"
4) let the dependencies install
5) run "node app.js"

