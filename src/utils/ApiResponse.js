class ApiResponse{
    constructor(StatusCode, data , message="success"){
        this.StatusCode=StatusCode
        this.data=data
        this.message=message
        this.success=StatusCode<400  
    }
}