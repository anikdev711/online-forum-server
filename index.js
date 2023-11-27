const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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