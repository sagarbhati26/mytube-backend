class ApiError extends Error {
    constructor(
        statusCode,
        message = "Something is wrong",  // Default value for message
        error = [],                      // Default value for error
        stack = ""                       // Default value for stack
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.error = error;
        this.success=false;
        
        if(stack){
            this.stack=stack
        }
        else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export{ApiError}