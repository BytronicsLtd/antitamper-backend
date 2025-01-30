const processResponse = require("../../utils/processResponse");
const chalk = require("chalk");
const { getYear, parse, parseISO } = require("date-fns");

const ScaleAntiTamperModel = require("../../models/scale-anti-tamper.model")


const controller = {
    updateScaleStatus: async (req, res) => {
        try {
            const payload = req.body;
            console.log("scale data payload ", payload)
            let { gps_lat, gps_lon, gsm_lat, gsm_lon, gps_datetime, gsm_datetime, rtc_datetime } = payload;
            let data = {
                ...payload
            }
            // gps location
            if (gps_lat?.length > 6  && gps_lon?.length > 6 ) {
                data.gps_location = {
                    type: 'Point',
                    coordinates: [gps_lon, gps_lat]
                };
            }
            // base station location
            if (gsm_lat?.length > 6 && gsm_lon?.length > 6) {
                data.gsm_location = {
                    type: 'Point',
                    coordinates: [gsm_lon, gsm_lat]
                };
            }
            // parse gps timestamp
            if (gps_datetime?.length > 10 ) {
                const iso_time = new Date(gps_datetime);
                data.gps_timestamp = iso_time;
            }
            else {
                data.gps_timestamp = undefined
            }
            // parse gsm timestamp
            if (gsm_datetime?.length > 10) {
                // Extract parts from "25/01/22,15:40:07"
                const [datePart, time] = gsm_datetime?.split(',');
                const just_time = time.split('+')[0]
                // Split and reverse date
                const [d, m, y] = datePart.split('/').reverse();
                const adjusted_date = new Date(`20${y}-${m}-${d} ${just_time}`)
                data.gsm_timestamp = new Date(adjusted_date - 3 * 60 * 60 * 1000)
            }
            // parse RTC timestamp
            if (rtc_datetime?.length > 5) {
                const formatted_date = rtc_datetime.replace(/(\d{2})\/(\d{2})\/(\d{2}),(.*)\+\d{2}/, '20$3-$2-$1T$4');
                const date = new Date(formatted_date); // Parse the formatted date                
                const adjusted_date = new Date(date.getTime() - 3 * 60 * 60 * 1000); // Add 3 hours
                data.rtc_timestamp = adjusted_date
            }


            console.log("data to save ", data);
            await ScaleAntiTamperModel.create(data)
            res.status(201).send({ success: true, cmd: 15 })
        } catch (error) {
            console.log(chalk.red("Error in device status"), error);
            res.status(500).send({ success: false })

        }
    },
    fetchMany: async (req, res) => {
        try {
            let = {
                device_id,
                interrupt_occured,
                start_datetime,
                end_datetime,
                search_term
            } = req.query;
            // query builder
            let query = {};
            //check for device id
            if (device_id) {
                query.device_id = device_id
            }
            // query by interrupt occurrence 
            if (interrupt_occured || interrupt_occured == 0) {
                query.interrupt_occured = parseInt(interrupt_occured)
            }
            // Handle start and end datetime for gsm_timestamp and rtc_timestamp
            if (start_datetime && end_datetime) {
                query.$or = [
                    {
                        gsm_timestamp: {
                            $gte: new Date(start_datetime).toISOString(),
                            $lte: new Date(end_datetime).toISOString()
                        }
                    },
                    {
                        rtc_timestamp: {
                            $gte: new Date(start_datetime).toISOString(),
                            $lte: new Date(end_datetime).toISOString()
                        }
                    }
                ];
            } else if (start_datetime) {
                // Only start_datetime is provided
                query.$or = [
                    { gsm_timestamp: { $gte: new Date(start_datetime).toISOString() } },
                    { rtc_timestamp: { $gte: new Date(start_datetime).toISOString() } }
                ];
            } else if (end_datetime) {
                // Only end_datetime is provided
                query.$or = [
                    { gsm_timestamp: { $lte: new Date(end_datetime).toISOString() } },
                    { rtc_timestamp: { $lte: new Date(end_datetime).toISOString() } }
                ];
            }

            // ---------------------- search query  ------------------------
            if (search_term) {
                query = {
                    ...query,
                    $or: [
                        { interrupt_type: { $regex: new RegExp(search_term, "i") } },
                        { device_id: { $regex: new RegExp(search_term, "i") } },

                    ],
                };
            }
            console.log("scale status filter ", query)
            const { page, size } = req.query;
            const limit = size ? +size : 1000;
            const offset = page ? (page - 1) * limit : 0;
            const results = await ScaleAntiTamperModel.paginate(query, {
                page, limit, offset,
                select: ``,
                sort: '-createdAt',

            });
            const docs = results.docs.map(result => {
                if (result?.gps_lat && result?.gps_lon) {
                    result = {
                        ...result._doc,
                        map_url: `https://www.google.com/maps/place/${result.gps_lat},${result.gps_lon}`

                    }
                }
                return result
            })
            results.docs = docs;
            // Add metadata for searchable parameters
            const metadata = {
                searchable_parameters: {
                    "device_id": "String",
                    "interrupt_occured": "Number [0,1]",
                    "start_datetime": "Date",
                    "end_datetime": "Date",
                    "search_term": "String"
                }
            };

            // Include metadata in the response
            processResponse({ req, res, success: true, status: 200, results, extras: { metadata } });
        } catch (error) {
            console.log(chalk.red("Error fetching Device"), error);
            processResponse({
                req, res, success: false, status: 500,
                message: {
                    en: "Error fetching Devices",
                },
            });
        }
    }

//Users
 /**
   * Create a new user
   */
  createUser: async (req, res) => {
    try {
      const { name, email, password, role } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ name, email, password: hashedPassword, role });
      await newUser.save();
      res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (error) {
      res.status(500).json({ message: 'Error creating user', error: error.message });
    }
  },

  /**
   * Get all users
   */
  getUsers: async (req, res) => {
    try {
      const users = await User.find();
      res.status(200).json({ users });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving users', error: error.message });
    }
  },

  /**
   * Get a user by ID
   */
  getUserById: async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ user });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving user', error: error.message });
    }
  },

  /**
   * Update a user by ID
   */
  updateUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const { name, email, role, status } = req.body;
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { name, email, role, status, updatedAt: Date.now() },
        { new: true }
      );
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
      res.status(500).json({ message: 'Error updating user', error: error.message });
    }
  },

  /**
   * Delete a user by ID
   */
  deleteUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const deletedUser = await User.findByIdAndDelete(userId);
      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
  },

  /**
   * User login
   */
  userLogin: async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  },

  /**
   * Send user invite
   */
  sendUserInvite: async (req, res) => {
    try {
      const { email } = req.body;
      // Logic to send an invite email
      res.status(200).json({ message: 'Invite sent successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error sending invite', error: error.message });
    }
  },


//Factories
/**
   * Create a new factory
   */
  createFactory: async (req, res) => {
    try {
      const { name, location } = req.body;
      const newFactory = new Factory({ name, location });
      await newFactory.save();
      res.status(201).json({ message: 'Factory created successfully', factory: newFactory });
    } catch (error) {
      res.status(500).json({ message: 'Error creating factory', error: error.message });
    }
  },

  /**
   * Get all factories
   */
  getFactories: async (req, res) => {
    try {
      const factories = await Factory.find();
      res.status(200).json({ factories });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving factories', error: error.message });
    }
  },

  /**
   * Get a factory by ID
   */
  getFactoryById: async (req, res) => {
    try {
      const { factoryId } = req.params;
      const factory = await Factory.findById(factoryId);
      if (!factory) {
        return res.status(404).json({ message: 'Factory not found' });
      }
      res.status(200).json({ factory });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving factory', error: error.message });
    }
  },

  /**
   * Update a factory by ID
   */
  updateFactory: async (req, res) => {
    try {
      const { factoryId } = req.params;
      const { name, location, status } = req.body;
      const updatedFactory = await Factory.findByIdAndUpdate(
        factoryId,
        { name, location, status, updatedAt: Date.now() },
        { new: true }
      );
      if (!updatedFactory) {
        return res.status(404).json({ message: 'Factory not found' });
      }
      res.status(200).json({ message: 'Factory updated successfully', factory: updatedFactory });
    } catch (error) {
      res.status(500).json({ message: 'Error updating factory', error: error.message });
    }
  },

  /**
   * Deactivate a factory by ID
   */
  deactivateFactory: async (req, res) => {
    try {
      const { factoryId } = req.params;
      const deactivatedFactory = await Factory.findByIdAndUpdate(
        factoryId,
        { status: 'inactive', updatedAt: Date.now() },
        { new: true }
      );
      if (!deactivatedFactory) {
        return res.status(404).json({ message: 'Factory not found' });
      }
      res.status(200).json({ message: 'Factory deactivated successfully', factory: deactivatedFactory });
    } catch (error) {
      res.status(500).json({ message: 'Error deactivating factory', error: error.message });
    }
  },
}

//Logs
   * Log a new activity
   */
  logActivity: async (req, res) => {
    try {
      const { userId, entityType, entityId, action, details } = req.body;

      const newLog = new ActivityLog({
        userId,
        entityType,
        entityId,
        action,
        details,
      });

      await newLog.save();
      res.status(201).json({ message: 'Activity logged successfully', log: newLog });
    } catch (error) {
      res.status(500).json({ message: 'Error logging activity', error: error.message });
    }
  },

  /**
   * Retrieve all activity logs
   */
  getAllActivityLogs: async (req, res) => {
    try {
      const logs = await ActivityLog.find().sort({ timestamp: -1 }); // Sort by most recent
      res.status(200).json({ logs });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving logs', error: error.message });
    }
  },

  /**
   * Retrieve logs by user ID
   */
  getLogsByUserId: async (req, res) => {
    try {
      const { userId } = req.params;
      const logs = await ActivityLog.find({ userId }).sort({ timestamp: -1 });
      res.status(200).json({ logs });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving logs by user', error: error.message });
    }
  },

  /**
   * Retrieve logs by entity type and ID
   */
  getLogsByEntity: async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await ActivityLog.find({ entityType, entityId }).sort({ timestamp: -1 });
      res.status(200).json({ logs });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving logs by entity', error: error.message });
    }
  },

  /**
   * Retrieve logs by date range
   */
  getLogsByDateRange: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const logs = await ActivityLog.find({
        timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) },
      }).sort({ timestamp: -1 });

      res.status(200).json({ logs });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving logs by date range', error: error.message });
    }
  },

  /**
   * Retrieve a log by ID
   */
  getActivityLogById: async (req, res) => {
    try {
      const { logId } = req.params;
      const log = await ActivityLog.findById(logId);

      if (!log) {
        return res.status(404).json({ message: 'Log not found' });
      }

      res.status(200).json({ log });
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving log by ID', error: error.message });
    }
  },

  /**
   * Delete logs older than a specific period
   */
  deleteOldLogs: async (req, res) => {
    try {
      const { period } = req.query; // Period in days (e.g., 30)
      const cutoffDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      const result = await ActivityLog.deleteMany({ timestamp: { $lt: cutoffDate } });

      res.status(200).json({ message: 'Old logs deleted successfully', deletedCount: result.deletedCount });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting old logs', error: error.message });
    }
  },


module.exports = controller;

