'use strict';

const PYMODE = false;
var CACHE_LOG = "";

function log(type, message) {
    if(message.toString() == CACHE_LOG.toString()) return; // Let's hide duplicate logs...

    CACHE_LOG = message;
    if(PYMODE) {
        send({'type':type, 'message': message});
    } else {
        console.log('[' + type + '] ' + message);
    }
}

// http://androidxref.com/kernel_3.18/xref/drivers/staging/android/uapi/binder.h#273
var binder_driver_command_protocol = {  // enum binder_driver_command_protocol
    "BC_TRANSACTION": 0,
    "BC_REPLY": 1,
    "BC_ACQUIRE_RESULT": 2,
    "BC_FREE_BUFFER": 3,
    "BC_INCREFS": 4,
    "BC_ACQUIRE": 5,
    "BC_RELEASE": 6,
    "BC_DECREFS": 7,
    "BC_INCREFS_DONE": 8,
    "BC_ACQUIRE_DONE": 9,
    "BC_ATTEMPT_ACQUIRE": 10,
    "BC_REGISTER_LOOPER": 11,
    "BC_ENTER_LOOPER": 12,
    "BC_EXIT_LOOPER": 13,
    "BC_REQUEST_DEATH_NOTIFICATION": 14,
    "BC_CLEAR_DEATH_NOTIFICATION": 15,
    "BC_DEAD_BINDER_DONE": 16,
};

// http://androidxref.com/kernel_3.18/xref/drivers/staging/android/uapi/binder.h#77
function parse_struct_binder_write_read(binder_write_read) {
    // arm64/include/uapi/linux/android/binder.h
    // struct binder_write_read {
    //     binder_size_t		write_size;	/* bytes to write */
    //     binder_size_t		write_consumed;	/* bytes consumed by driver */
    //     binder_uintptr_t	write_buffer;
    //     binder_size_t		read_size;	/* bytes to read */
    //     binder_size_t		read_consumed;	/* bytes consumed by driver */
    //     binder_uintptr_t	read_buffer;
    // };
    var offset = 8; // 64b

    return {
        "write_size": binder_write_read.readU64(),
        "write_consumed": binder_write_read.add(offset).readU64(),
        "write_buffer": binder_write_read.add(offset * 2).readPointer(),
        "read_size": binder_write_read.add(offset * 3).readU64(),
        "read_consumed": binder_write_read.add(offset * 4).readU64(),
        "read_buffer": binder_write_read.add(offset * 5).readPointer()
    }
}

// http://androidxref.com/kernel_3.18/xref/drivers/staging/android/uapi/binder.h#129
function parse_binder_transaction_data(binder_transaction_data) {
    // arm64/include/uapi/linux/android/binder.h
    // struct binder_transaction_data {
    //     /* The first two are only used for bcTRANSACTION and brTRANSACTION,
    //      * identifying the target and contents of the transaction.
    //      */
    //     union {
    //         /* target descriptor of command transaction */
    //         __u32	handle;
    //         /* target descriptor of return transaction */
    //         binder_uintptr_t ptr;
    //     } target;
    //     binder_uintptr_t	cookie;	/* target object cookie */
    //     __u32		code;		/* transaction command */
    //
    //     /* General information about the transaction. */
    //     __u32	        flags;
    //     pid_t		sender_pid;
    //     uid_t		sender_euid;
    //     binder_size_t	data_size;	/* number of bytes of data */
    //     binder_size_t	offsets_size;	/* number of bytes of offsets */
    //
    //     /* If this transaction is inline, the data immediately
    //      * follows here; otherwise, it ends with a pointer to
    //      * the data buffer.
    //      */
    //     union {
    //         struct {
    //             /* transaction data */
    //             binder_uintptr_t	buffer;
    //             /* offsets from buffer to flat_binder_object structs */
    //             binder_uintptr_t	offsets;
    //         } ptr;
    //         __u8	buf[8];
    //     } data;
    // };
    return {
        "target": { // can either be u32 (handle) or 64b ptr
            "handle": binder_transaction_data.readU32(),
            "ptr": binder_transaction_data.readPointer()
        },
        "cookie": binder_transaction_data.add(8).readPointer(),
        "code": binder_transaction_data.add(16).readU32(),
        "flags": binder_transaction_data.add(20).readU32(),
        "sender_pid": binder_transaction_data.add(24).readS32(),
        "sender_euid": binder_transaction_data.add(28).readU32(),
        "data_size": binder_transaction_data.add(32).readU64(),
        "offsets_size": binder_transaction_data.add(40).readU64(),
        "data": {
            "ptr": {
                "buffer": binder_transaction_data.add(48).readPointer(),
                "offsets": binder_transaction_data.add(56).readPointer()
            },
            "buf": binder_transaction_data.add(48).readByteArray(8)
        }
    }
}

// http://androidxref.com/kernel_3.18/xref/drivers/staging/android/binder.c#1754
function handle_write(write_buffer, write_size, write_consumed) { // binder_thread_write
    var cmd = write_buffer.readU32() & 0xff;
    var ptr = write_buffer.add(write_consumed + 4); // 4 = sizeof(uint32_t), the first 4 bytes contain "cmd"
    var end = write_buffer.add(write_size);

    switch (cmd) {
        // Implement cases from binder_driver_command_protocol, we're only interested in BC_TRANSACTION / BC_REPLY
        case binder_driver_command_protocol.BC_TRANSACTION:
        case binder_driver_command_protocol.BC_REPLY:
            // log('INFO', "TRANSACTION / BC_REPLY!");
            var binder_transaction_data = parse_binder_transaction_data(ptr);

            // Show me the secrets
            log("INFO", "\n" + hexdump(binder_transaction_data.data.ptr.buffer, {
                length: binder_transaction_data.data_size,
                ansi: true,
            }) + "\n");
            break;
        default:
            // log('ERR', 'NOOP handler')
    }
}

Java.perform(function(){
    var ioctl = Module.findExportByName("libbinder.so", "ioctl");
    Interceptor.attach(ioctl, {
        onEnter: function(args) {
            var fd = args[0]; // int
            var cmd = args[1]; // int

            // value calculated from #define BINDER_WRITE_READ		_IOWR('b', 1, struct binder_write_read)
            if(cmd != 0xc0306201) return;  // if 0xc0306201 then enter BINDER_WRITE_READ flow
            var data = args[2]; // void * -> pointer to binder_write_read

            var binder_write_read = parse_struct_binder_write_read(data);

            if(binder_write_read.write_size > 0) {
                handle_write(binder_write_read.write_buffer, binder_write_read.write_size, binder_write_read.write_consumed);
            }
        }
    })
});


