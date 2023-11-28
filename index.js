const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.l2zfswc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("forumDb").collection("users");
    const postCollection = client.db("forumDb").collection("posts");
    const reportCollection = client.db("forumDb").collection("reports");
    const announcementCollection = client.db("forumDb").collection("announcements");
    const paymentCollection = client.db("forumDb").collection("payments");



    //jwt related
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      console.log(token);
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      });
    }


    //user related

    //get all users
    app.get('/users', async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    //get specific user
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email
      }
      const result = await userCollection.findOne(query);
      res.send(result)
    })

    //for admin only
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email
      }
      const userOfForum = await userCollection.findOne(query);
      let admin = false;
      if (userOfForum) {
        admin = userOfForum?.role === 'admin';
      }
      res.send({ admin });
    })

    //make admin

    app.put('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = {
        _id: new ObjectId(id)
      }
      const options = { upsert: true };
      const updateRoleOfUser = {
        $set: {
          role: 'admin'
        }
      }

      const result = await userCollection.updateOne(filter, updateRoleOfUser, options);
      res.send(result)


    })

    //delete user
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })






    //post operation
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = {
        email: user.email
      }
      const isUserExist = await userCollection.findOne(query);
      if (isUserExist) {
        return res.send({ message: 'user exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })












    //post related

    //post count
    app.get('/posts/count/:email', async (req, res) => {
      const userEmail = req.params.email;
      // console.log(userEmail);

      const query = {
        authorEmail: userEmail
      }

      // console.log(query);
      const userPostsCount = await postCollection.countDocuments(query);
      // const userPostsCount = await postCollection.estimatedDocumentCount({ userEmail });
      // const userPostsCount = await postCollection.estimatedDocumentCount(query);
      // console.log(userPostsCount);
      res.send({ userPostsCount })
    })

    //find all posts
    app.get('/posts', async (req, res) => {
      const result = await postCollection.find().toArray();
      res.send(result);
    })

    //find specific user's  post
    app.get('/posts/:email', async (req, res) => {
      const email = req.params.email;
      const query = {
        authorEmail: email
      }
      const result = await postCollection.find(query).toArray();
      res.send(result);
    })


    //find specific post
    app.get('/posts/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await postCollection.findOne(query);
      res.send(result)
    })





    //users posts
    app.post('/posts', async (req, res) => {
      const {
        authorImage,
        authorName,
        authorEmail,
        postTitle,
        postDescription,
        tag
      } = req.body;
      const postTime = new Date();
      const result = await postCollection.insertOne({
        authorImage,
        authorName,
        authorEmail,
        postTitle,
        postDescription,
        tag,
        upVote: 0,
        downVote: 0,
        postTime
      });
      res.send(result);
    })



    //vote
    app.post('/posts/vote', async (req, res) => {
      const { userPostId, userVoteType } = req.body;
      const query = {
        _id: new ObjectId(userPostId)
      }
      const findPost = await postCollection.findOne(query);
      if (!findPost) {
        return res.status(404).send({ message: 'post not found' })
      }

      if (userVoteType === 'upVote') {
        await postCollection.updateOne(query, { $inc: { upVote: 1 } });
      }
      else if (userVoteType === 'downVote') {
        await postCollection.updateOne(query, { $inc: { downVote: 1 } });
      }

      res.send({ success: true });




    })

    //post comments

    app.get('/posts/comments/:postId', async (req, res) => {
      const postId = req.params.postId;
      const query = {
        _id: new ObjectId(postId)
      }
      const result = await postCollection.findOne(query);
      res.send(result)
    })





    app.post('/posts/comments/:postId', async (req, res) => {
      const postId = req.params.postId;
      const {
        commenterEmail,
        userComment
      } = req.body;
      const commentTime = new Date();
      const query = {
        _id: new ObjectId(postId)
      }
      const result = await postCollection.updateOne(query, {
        $push: {
          comments: {
            commenterEmail,
            userComment,
            commentTime
          }
        }
      })
      res.send(result)
    })


    //delete post
    app.delete('/posts/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await postCollection.deleteOne(query);
      res.send(result)
    })

    //report related

    app.get('/reports', async (req, res) => {
      const result = await reportCollection.find().toArray();
      res.send(result)
    })



    app.post('/reports', async (req, res) => {
      const report = req.body;
      const result = await reportCollection.insertOne(report);
      res.send(result);

    })

    //announcements
    app.get('/announcements', async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result)
    })

    // app.get('/announcements/count/:email', async (req, res) => {
    //   const userEmail = req.params.email;
    //   const query = {
    //     authorEmail: userEmail
    //   }
    //   const announcementCount = await announcementCollection.countDocuments(query);
    //   res.send({ announcementCount })
    // })

    app.get('/announcements/count', async (req, res) => {

      const announcementCount = await announcementCollection.countDocuments();
      res.send({ announcementCount })
    })

    app.post('/announcements', async (req, res) => {
      const announcement = req.body;
      const result = await announcementCollection.insertOne(announcement);
      res.send(result);
    })

    //payment
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send({ paymentResult })
    })




    // app.post("/payments", async (req, res) => {
    //   let { amount, id } = req.body
    //   try {
    //     const payment = await stripe.paymentIntents.create({
    //       amount,
    //       currency: "USD",
    //       description: "Byte Talks",
    //       payment_method: id,
    //       confirm: true
    //     })
    //     console.log("Payment", payment)
    //     res.send({
    //       message: "Payment successful",
    //       success: true
    //     })
    //   } catch (error) {
    //     console.log("Error", error)
    //     res.send({
    //       message: "Payment failed",
    //       success: false
    //     })
    //   }
    // })



















    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);







app.get('/', (req, res) => {
  res.send('Online Forum Running')
})

app.listen(port, () => {
  console.log(`Online forum is listening on port ${port}`)
})