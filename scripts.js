const userName = "ExcelOne-"+ Math.floor(Math.random() * 100000)
const password = "x";
document.querySelector('#user-name').innerHTML = userName;

const socket = io.connect('https://192.168.1.14:8181/',{
    auth: {
        userName,password
    }
})

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; // a var to hold the local video stream
let remoteStream; // a var to hold the remote video stream
let peerConnection; // the peerConnection that the two clients use to talk
let didIOffer = false;

let peerConfiguration = {
    iceServers:[
        {
            urls:[
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302'
            ]
        }
    ]
}

const call = async e => {
    await fetchUserMedia();

    await createPeerConnection();

    try {
        console.log("Creating offer...")
        const offer = await peerConnection.createOffer();
        console.log(offer);
        peerConnection.setLocalDescription(offer);
        didIOffer = true;
        socket.emit('newOffer', offer); 
    } catch (err) {
        console.log(err)
    }
}

//client 2
const answerOffer = async(offerObj) => {
    await fetchUserMedia()
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer({}); 
    await peerConnection.setLocalDescription(answer); 
    console.log(offerObj)
    console.log(answer)
    offerObj.answer = answer;
    // emit the answer to the signaling server, so it can emit to CLIENT1
    const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj)
    offerIceCandidates.forEach(c => {
        peerConnection.addIceCandidate(c);
        console.log("======Added Ice Candidate======")
    })
    console.log(offerIceCandidates)
}

const addAnswer = async(offerObj) => {
    await peerConnection.setRemoteDescription(offerObj.answer)
}

const fetchUserMedia = () => {
    return new Promise(async(resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localVideoEl.srcObject = stream;
            localStream = stream;
            resolve();
        } catch (err) {
            console.log(err);
            reject()
        }
    })
}

const createPeerConnection = (offerObj) => {
    return new Promise(async(resolve, reject) => {
        peerConnection = await new RTCPeerConnection(peerConfiguration)
        remoteStream = new MediaStream()
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        })

        peerConnection.addEventListener("signalingstatechange", (event) => {
            console.log(event);
            console.log(peerConnection.signalingState)
        });

        peerConnection.addEventListener('icecandidate', e => {
            console.log('........Ice candidate found!......')
            if (e.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: e.candidate,
                    iceUserName: userName,
                    didIOffer,
                })
            }
        })

        peerConnection.addEventListener('track', e => {
            console.log("Got a track from the other peer!! How exciting")
            e.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track, remoteStream);
            })
        })

        if (offerObj) {
            await peerConnection.setRemoteDescription(offerObj.offer)
        }
        resolve();
    })
}

const addNewIceCandidate = iceCandidate => {
    peerConnection.addIceCandidate(iceCandidate)
    console.log("======Added Ice Candidate======")
}

const hangup = () => {
    console.log("Hanging up the call...");

    // Close the peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Stop local video stream
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    // Reset the video elements
    localVideoEl.srcObject = null;
    remoteVideoEl.srcObject = null;

    // Notify the signaling server about the hangup
    socket.emit('hangupCall', { userName });

    console.log("Call ended.");
};

const muteAudio = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = false; 
        });
    }
    document.querySelector('#mute').style.display = "none";
    document.querySelector('#unmute').style.display = "inline";
};

const unmuteAudio = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = true; 
        });
    }
    document.querySelector('#mute').style.display = "inline";
    document.querySelector('#unmute').style.display = "none";
};

document.querySelector('#call').addEventListener('click', call);
document.querySelector('#hangup').addEventListener('click', hangup);
document.querySelector('#mute').addEventListener('click', muteAudio);
document.querySelector('#unmute').addEventListener('click', unmuteAudio);
