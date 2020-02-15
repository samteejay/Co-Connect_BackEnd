const functions = require("firebase-functions");
const app = require("express")();
const FBAuth = require("./util/fbAuth");
const { db } = require("./util/admin");
const { 
  getAllScreams, 
  postOneScream, 
  getScream,
  commentOnScream,
  likeScream,
  unlikeScream,
  deleteScream
} = require("./handlers/screams");
const { 
  signup, 
  login, 
  uploadImage, 
  addUserDetails,
  getAuthenticatedDetails, 
  getUserDetails,
  markNotificationsRead 
} = require("./handlers/users");


// Scream routes
app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, postOneScream);
app.get("/scream/:screamId", getScream);
app.delete("/scream/:screamId", FBAuth, deleteScream);
app.get("/scream/:screamId/like", FBAuth, likeScream);
app.get("/scream/:screamId/unlike", FBAuth, unlikeScream);
app.post("/scream/:screamId/comment", FBAuth, commentOnScream);


// Users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedDetails);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);


// https://baseurls.com/api/
exports.api = functions.region("europe-west1").https.onRequest(app);

// notifications
exports.createNotificationOnLike = function.region('europe-west1').firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
      .then(doc => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/`${snapshot.id}).set({
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            read: false,
            screamId: doc.id,
            type: 'like',
            createdAt: new Date().toISOString
          });
        }
      })
      .catch(err => {
        console.error(err);
      })
  });

  exports.deleteNotificationOnUnLike = function.region('europe-west1').firestore.document('comments/{id}')
  .onDelete((snapshot) => {
    return db.doc(`/notifications/${snapshot.Id}`).delete()
     .catch(err => {
        console.error(err);
        return;
      })
  });
  
  exports.createNotificationOnComment = function.region('europe-west1').firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db.doc(`/screams/${snapshot.data().screamId}`).get()
      .then(doc => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/`${snapshot.id}).set({
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            read: false,
            screamId: doc.id,
            type: 'comment',
            createdAt: new Date().toISOString
          });
        }
      })
      .catch(err => {
        console.error(err);
        return;
      })
  });

  exports.onUserImageChange = function.region('europe-west1').firestore.document('comments/{id}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('Image has changed');
      const batch = db.batch();
      return db.collection('screams').where('userHandle', '==', change.before.data().handle).get()
      .then((data) => {
        data.forEach(doc => {
          const scream = db.doc(`scream/${doc.id}`);
          batch.update(scream, { userImage: change.after.data().imageUrl});
        })
        return batch.commit();
      })
    }
  });

  exports.onScreamDelete = function.region('europe-west1').firestore.document('screams/{screamsId}')
  .onDelete((snapshot, context) => {
    
   const screamId = context.params.screamId;
   const batch = db.batch();
      return db.collection('comments').where('screamId', '==', screamId).get()
      .then((data) => {
        data.forEach(doc => {
         batch.delete(db.doc(`/comments/${doc.id}`));
        })
        return db.collection('likes').where('screamId', '==', screamId);
      })
      .then((data) => {
        data.forEach(doc => {
         batch.delete(db.doc(`/likes/${doc.id}`));
        })
        return db.collection('notification').where('screamId', '==', screamId);
      })
      .then((data) => {
        data.forEach(doc => {
         batch.delete(db.doc(`/notification/${doc.id}`));
        })
        return batch.commit();
      })
      .catch(err => {
        console.error(err);
      })
  })